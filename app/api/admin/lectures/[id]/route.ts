import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'
import {
  ValidationError,
  assertJoinUrlRule,
  optionalDuration,
  optionalText,
  optionalType,
  optionalUrl,
  riyadhToInstant,
} from '@/lib/server/validate'
import type { LectureType } from '@/lib/types'

/**
 * تعديل لقاء مفرد.
 *
 * الحقول الفارغة تعني **الوراثة** لا المسح: `null` في اللقاء يجعله يرث
 * سلسلته. فالمشرف الذي يمسح حقل المدة لا يُلغي المدة، بل يعيد اللقاء إلى
 * مدّة سلسلته.
 *
 * القاعدة ٦.٥: الكتابة بمفتاح الخدمة بعد فحص كوكي المشرف، لا من المتصفح.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SeriesDefaults {
  type: LectureType
  join_url: string | null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail('معرّف اللقاء غير صالح.')
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('طلب غير صالح.')
  }

  let patch: {
    starts_at: string
    duration_min: number | null
    type: LectureType | null
    place: string | null
    join_url: string | null
    is_cancelled: boolean
  }

  try {
    patch = {
      starts_at: riyadhToInstant(body.date, body.time),
      duration_min: optionalDuration(body.duration_min),
      type: optionalType(body.type),
      place: optionalText(body.place, 'المكان'),
      join_url: optionalUrl(body.join_url, 'رابط الدخول'),
      is_cancelled: body.is_cancelled === true,
    }
  } catch (e) {
    if (e instanceof ValidationError) return fail(e.message)
    return fail('تعذّر قراءة البيانات المُرسلة.')
  }

  // نحتاج قيم السلسلة لنحسب النوع والرابط **الفعّالين بعد الوراثة**
  const { data: lecture, error: readErr } = await supabaseAdmin
    .from('lectures')
    .select('id, series_id, series:series_id (type, join_url)')
    .eq('id', id)
    .maybeSingle()

  if (readErr) return fail('تعذّر الوصول إلى بيانات اللقاء.', 503)
  if (!lecture) return fail('لا يوجد لقاء بهذا المعرّف.', 404)

  const series = lecture.series as unknown as SeriesDefaults | null
  if (!series) return fail('تعذّر الوصول إلى بيانات السلسلة.', 503)

  const effectiveType = patch.type ?? series.type
  const effectiveJoinUrl = patch.join_url ?? series.join_url

  try {
    assertJoinUrlRule(effectiveType, effectiveJoinUrl)
  } catch (e) {
    if (e instanceof ValidationError) return fail(e.message, 422)
    throw e
  }

  const { error: writeErr } = await supabaseAdmin.from('lectures').update(patch).eq('id', id)

  if (writeErr) {
    // قيود قاعدة البيانات حارسٌ أخير — رسالتها إنجليزية فتُترجَم هنا
    const msg = writeErr.message ?? ''
    if (msg.includes('lectures_duration_range')) return fail('المدة: بين ٥ و٦٠٠ دقيقة.', 422)
    if (msg.includes('lectures_ord_unique')) return fail('ترتيب مكرّر في السلسلة نفسها.', 422)
    return fail('تعذّر حفظ التعديل. حاول مرة أخرى.', 503)
  }

  return NextResponse.json({ ok: true })
}
