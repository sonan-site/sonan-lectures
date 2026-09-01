import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'
import { ValidationError, optionalUrl, requiredText } from '@/lib/server/validate'

/**
 * حفظ إعدادات المقر.
 *
 * ⚠️ الأثر الجانبي ٨.١ — أثرٌ مقصود لا خلل:
 * تغيير «اسم المقر» يغيّر المكان المعروض في **كل** اللقاءات التي لم يُكتب لها
 * مكان خاص، بما فيها الماضية. سببه أن الوراثة بالمرجع لا بالنسخ:
 * `coalesce(l.place, s.place, cfg.hq_place)` في العرض `v_lectures`.
 * فلا تُنشأ نسخ تاريخية من تلقاء النفس — والقرار لصاحب المشروع.
 *
 * وجدول `settings` صفٌّ واحد بقيد `settings_singleton`. لذلك `update` لا
 * `upsert`: الثاني قد يحاول إدراج صفٍّ ثانٍ فيصطدم بالقيد.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('طلب غير صالح.')
  }

  let patch: { hq_place: string; hq_map_url: string | null; updated_at: string }
  try {
    patch = {
      hq_place: requiredText(body.hq_place, 'اسم المكان', 200),
      hq_map_url: optionalUrl(body.hq_map_url, 'رابط الموقع على الخرائط'),
      updated_at: new Date().toISOString(),
    }
  } catch (e) {
    if (e instanceof ValidationError) return fail(e.message, 422)
    return fail('تعذّر قراءة البيانات المُرسلة.')
  }

  // `id` قيمته `true` دائماً بحكم قيد الصفّ الواحد
  const { data, error } = await supabaseAdmin
    .from('settings')
    .update(patch)
    .eq('id', true)
    .select('hq_place')
    .maybeSingle()

  if (error) return fail('تعذّر حفظ الإعدادات. حاول مرة أخرى.', 503)
  if (!data) return fail('لا يوجد صفّ إعدادات في قاعدة البيانات.', 500)

  return NextResponse.json({ ok: true })
}
