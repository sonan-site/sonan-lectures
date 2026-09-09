import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'
import { ValidationError, requiredSlug, requiredText } from '@/lib/server/validate'

/**
 * إخفاء الشيخ وتنشيطه وتعديل اسمه ورابطه وحذفه من قائمة القوالب.
 *
 * **الإخفاء** (`is_active = false`) يخرجه من اختيار السلسلة ومن تصفية
 * الزائر، وتبقى لقاءاته ظاهرة في «السابقة» — القاعدة ٦.٦ كما هي.
 *
 * **والحذف** أُضيف بعد هجرة ٠٠٢، وهو نقض صريح لنصّ ٦.٦ ولمنع القسم ٥،
 * لكنه يحفظ *غرضهما* أتمَّ ممّا كان: القاعدة إنما مُنعت لئلّا يُمحى تاريخ،
 * وكان حذف الشيخ يومها يُيتِّم سلاسله. أما اليوم فاسمه ورابطه لقطةٌ محفوظة
 * داخل كل سلسلة، والمرجع `on delete set null` — فحذفه من القائمة لا يمسّ
 * سلسلةً ولا لقاءً ولا حتى رابطه العام `/sheikh/<slug>`.
 *
 * فالجدول صار ما وصفه صاحب المشروع: **قائمة قوالب**، حذف القالب منها
 * لا يمسّ ما بُني به.
 *
 * **والتعديل** (هجرة ٠٠٥) يخيّر المشرف صراحة بين تطبيق الاسم والرابط
 * الجديدين على سلاسل هذا الشيخ ولقاءاته المتجاوِزة **القائمة** أيضاً
 * (`apply_existing: true`)، أو الإبقاء عليها بالقديم (السلوك الموثَّق
 * أصلاً: لا يسري رجعياً). تعديل الرابط بلا هذا الخيار كان سيُنتج صفحتين
 * عامّتين لشخص واحد — القديمة والجديدة — فالخيار يُغلق ذلك تماماً حين
 * يُختار.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  if (!UUID.test(id)) return fail('معرّف الشيخ غير صالح.')

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('طلب غير صالح.')
  }

  if (typeof body.is_active === 'boolean') {
    const { data, error } = await supabaseAdmin
      .from('sheikhs')
      .update({ is_active: body.is_active })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return fail('تعذّر حفظ التغيير. حاول مرة أخرى.', 503)
    if (!data) return fail('لا يوجد شيخ بهذا المعرّف.', 404)

    return NextResponse.json({
      ok: true,
      message: body.is_active ? 'صار نشطاً' : 'أُخفي — ولقاءاته السابقة باقية',
    })
  }

  let name: string
  let slug: string
  try {
    name = requiredText(body.name, 'الاسم', 120)
    slug = requiredSlug(body.slug, 'رابط صفحته')
  } catch (e) {
    if (e instanceof ValidationError) return fail(e.message, 422)
    return fail('تعذّر قراءة البيانات المُرسلة.')
  }
  const applyExisting = body.apply_existing === true

  const { error } = await supabaseAdmin.rpc('admin_edit_sheikh', {
    p_sheikh_id: id,
    p_name: name,
    p_slug: slug,
    p_apply_existing: applyExisting,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('sheikh_not_found')) return fail('لا يوجد شيخ بهذا المعرّف.', 404)
    if (msg.includes('sheikhs_slug_key') || msg.includes('duplicate key')) {
      return fail('هذا الرابط مستخدم لشيخ آخر. اختر رابطاً غيره.', 409)
    }
    if (msg.includes('sheikhs_slug_format')) {
      return fail('رابط صفحته: حروف لاتينية صغيرة وأرقام وشُرَط فقط.', 422)
    }
    return fail('تعذّر حفظ التعديل. حاول مرة أخرى.', 503)
  }

  return NextResponse.json({
    ok: true,
    message: applyExisting ? 'حُفظ التعديل — وطُبِّق على سلاسله ولقاءاته القائمة' : 'حُفظ التعديل',
  })
}

/**
 * حذف قالب الشيخ من القائمة.
 *
 * لا يمسّ سلسلةً ولا لقاءً: قيد `series.sheikh_id` وقيد `lectures.sheikh_id`
 * كلاهما `on delete set null` (هجرة ٠٠٣ مدّت النمط إلى تجاوز اللقاء أيضاً)،
 * فيُفرَّغ المرجعان معاً واللقطة هي مصدر الاسم والرابط في كل ما يُعرض.
 *
 * `?expect=<عدد السلاسل>&expectLectures=<عدد اللقاءات المتجاوِزة>` إلزاميّان،
 * وهما العددان اللذان ذكرتهما نافذة التأكيد — فلا يُحذف قالبٌ صار له منذ
 * لحظة العرض ما لم يره المشرف.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  if (!UUID.test(id)) return fail('معرّف الشيخ غير صالح.')

  const sp = new URL(request.url).searchParams
  const rawSeries = sp.get('expect')
  const rawLectures = sp.get('expectLectures')
  const expectSeries = Number(rawSeries)
  const expectLectures = Number(rawLectures)
  if (
    rawSeries === null ||
    !Number.isInteger(expectSeries) ||
    expectSeries < 0 ||
    rawLectures === null ||
    !Number.isInteger(expectLectures) ||
    expectLectures < 0
  ) {
    return fail('طلب الحذف ناقص. أعد تحميل الصفحة وحاول مرة أخرى.')
  }

  const { data: sheikh, error: readErr } = await supabaseAdmin
    .from('sheikhs')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()

  if (readErr) return fail('تعذّر الوصول إلى بيانات الشيخ.', 503)
  if (!sheikh) return fail('لا يوجد شيخ بهذا المعرّف.', 404)

  const [seriesRes, lecturesRes] = await Promise.all([
    supabaseAdmin.from('series').select('id', { count: 'exact', head: true }).eq('sheikh_id', id),
    supabaseAdmin.from('lectures').select('id', { count: 'exact', head: true }).eq('sheikh_id', id),
  ])

  if (seriesRes.error || seriesRes.count === null) return fail('تعذّر إحصاء سلاسل الشيخ.', 503)
  if (lecturesRes.error || lecturesRes.count === null) return fail('تعذّر إحصاء لقاءات الشيخ.', 503)

  const count = seriesRes.count
  const lectureCount = lecturesRes.count

  if (count !== expectSeries || lectureCount !== expectLectures) {
    return fail(
      `تغيّر عدد سلاسل أو لقاءات هذا الشيخ (${count} سلسلة و${lectureCount} لقاء متجاوِز، لا ${expectSeries} و${expectLectures}). أعد تحميل الصفحة وراجع قبل الحذف.`,
      409
    )
  }

  const { error: delErr } = await supabaseAdmin.from('sheikhs').delete().eq('id', id)
  if (delErr) return fail('تعذّر حذف الشيخ من القائمة. حاول مرة أخرى.', 503)

  const untouched = count === 0 && lectureCount === 0
  return NextResponse.json({
    ok: true,
    message: untouched
      ? `حُذف «${sheikh.name}» من قائمة القوالب`
      : `حُذف «${sheikh.name}» من القائمة — و${count} من سلاسله و${lectureCount} من لقاءاته المتجاوِزة باقية باسمه`,
  })
}
