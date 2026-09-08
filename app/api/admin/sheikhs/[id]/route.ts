import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'

/**
 * إخفاء الشيخ وتنشيطه وحذفه من قائمة القوالب.
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

  if (typeof body.is_active !== 'boolean') {
    return fail('القيمة المطلوبة: نشط أو غير نشط.')
  }

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
