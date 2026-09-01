import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'
import {
  ValidationError,
  assertJoinUrlRule,
  optionalDuration,
  optionalText,
  optionalUrl,
  requiredSlug,
  requiredText,
  requiredType,
  requiredUuid,
} from '@/lib/server/validate'

/**
 * إنشاء سلسلة ولقاءاتها في عملية واحدة.
 *
 * اللقاء المنفرد ليس استثناءً: يُنشأ له سلسلة من لقاء واحد، حفاظاً على
 * قاعدة واحدة بلا حالات خاصة (ADR-0001).
 *
 * الترتيب `ord` يُسنَد هنا تسلسلياً ١..ن على المواعيد **الباقية** بعد ما
 * حذفه المشرف من المعاينة — فحذف موعد من أربعة يُنتج ثلاثة صفوف ترتيبها
 * ١ و٢ و٣ بلا فجوة (معيار القبول ١١).
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_LECTURES = 60

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('طلب غير صالح.')
  }

  let series: {
    title: string
    slug: string
    book: string | null
    sheikh_id: string
    type: ReturnType<typeof requiredType>
    place: string | null
    map_url: string | null
    join_url: string | null
    duration_min: number
  }
  let starts: string[]

  try {
    const type = requiredType(body.type)
    const joinUrl = optionalUrl(body.join_url, 'رابط الدخول')

    // القاعدة ٦.٨ على السلسلة نفسها — القيد في المخطط يحرسها، والرسالة هنا عربية
    assertJoinUrlRule(type, joinUrl)

    series = {
      title: requiredText(body.title, 'عنوان اللقاء', 200),
      slug: requiredSlug(body.slug),
      book: optionalText(body.book, 'اسم الكتاب', 200),
      sheikh_id: requiredUuid(body.sheikh_id, 'الشيخ'),
      type,
      // النوع «عن بُعد» لا مكان له، فلا يُخزَّن مكانٌ يُربك العرض
      place: type === 'remote' ? null : optionalText(body.place, 'المكان'),
      map_url: type === 'remote' ? null : optionalUrl(body.map_url, 'رابط الخرائط'),
      join_url: type === 'onsite' ? null : joinUrl,
      duration_min: optionalDuration(body.duration_min) ?? 90,
    }

    const raw = body.starts
    if (!Array.isArray(raw) || raw.length === 0) {
      return fail('لم يبقَ أي موعد. اختر تاريخ أول لقاء، ولا تحذف المواعيد كلها.')
    }
    if (raw.length > MAX_LECTURES) {
      return fail(`عدد اللقاءات أكثر من ${MAX_LECTURES}.`)
    }

    starts = raw.map((v, i) => {
      if (typeof v !== 'string') throw new ValidationError(`الموعد رقم ${i + 1} غير صالح.`)
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) throw new ValidationError(`الموعد رقم ${i + 1} غير صالح.`)
      return d.toISOString()
    })
  } catch (e) {
    if (e instanceof ValidationError) return fail(e.message, 422)
    return fail('تعذّر قراءة البيانات المُرسلة.')
  }

  // الشيخ موجود ونشط — القاعدة ٦.٦ تُخرج غير النشط من اختيار السلسلة
  const { data: sheikh, error: shErr } = await supabaseAdmin
    .from('sheikhs')
    .select('id, is_active')
    .eq('id', series.sheikh_id)
    .maybeSingle()

  if (shErr) return fail('تعذّر التحقّق من الشيخ.', 503)
  if (!sheikh) return fail('الشيخ المُختار غير موجود.', 422)
  if (!sheikh.is_active) return fail('الشيخ المُختار غير نشط، فلا تُنشأ له سلسلة جديدة.', 422)

  const { data: created, error: seriesErr } = await supabaseAdmin
    .from('series')
    .insert(series)
    .select('id, slug')
    .single()

  if (seriesErr || !created) {
    const msg = seriesErr?.message ?? ''
    if (msg.includes('series_slug_key') || msg.includes('duplicate key')) {
      return fail('هذا الرابط مستخدم لسلسلة أخرى. اختر رابطاً غيره.', 409)
    }
    if (msg.includes('series_link_required')) {
      return fail('لقاء غير حضوري يلزمه رابط دخول.', 422)
    }
    if (msg.includes('series_slug_format')) {
      return fail('رابط الصفحة: حروف لاتينية صغيرة وأرقام وشُرَط فقط.', 422)
    }
    return fail('تعذّر إنشاء السلسلة. حاول مرة أخرى.', 503)
  }

  const rows = starts
    .slice()
    .sort()
    .map((iso, i) => ({ series_id: created.id, ord: i + 1, starts_at: iso }))

  const { error: lecErr } = await supabaseAdmin.from('lectures').insert(rows)

  if (lecErr) {
    // لا نترك سلسلة بلا لقاءات (القسم ٧): نتراجع عمّا أُنشئ
    await supabaseAdmin.from('series').delete().eq('id', created.id)
    return fail('تعذّر إنشاء مواعيد السلسلة، فأُلغي إنشاؤها كاملاً. حاول مرة أخرى.', 503)
  }

  return NextResponse.json({ ok: true, slug: created.slug, count: rows.length })
}
