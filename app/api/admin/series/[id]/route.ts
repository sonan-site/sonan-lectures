import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'

/**
 * أرشفة السلسلة واسترجاعها وحذفها.
 *
 * **الفرق بين الأرشفة والحذف** — وهو جوهر هذا الملف:
 *   · الأرشفة ختمُ وقتٍ في `archived_at`. تختفي السلسلة ولقاءاتها عن الزائر،
 *     وتبقى كاملةً في اللوحة، ويُلغى الأثر بضغطة. لما انتهى ولا يُراد عرضه.
 *   · الحذف نهائيّ، ويأخذ لقاءاتها معه بـ`on delete cascade` (الأثر ٨.٢).
 *     لخطأ الإدخال الطازج وحده.
 *
 * ولا سجلّ لما حُذف: القسم ١٠ يمنع سجلّ التعديلات، فالأرشفة هي البديل الآمن.
 * ولذلك يحرس الحذفَ حارسان: تأكيد في الواجهة، و`expect` هنا.
 *
 * القاعدة ٦.٥: الكتابة بمفتاح الخدمة بعد فحص كوكي المشرف.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** أرشفة أو استرجاع */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  if (!UUID.test(id)) return fail('معرّف السلسلة غير صالح.')

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('طلب غير صالح.')
  }

  if (body.action !== 'archive' && body.action !== 'restore') {
    return fail('الإجراء المطلوب: أرشفة أو استرجاع.')
  }
  const archive = body.action === 'archive'

  const { data, error } = await supabaseAdmin
    .from('series')
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id, title')
    .maybeSingle()

  if (error) return fail('تعذّر حفظ التغيير. حاول مرة أخرى.', 503)
  if (!data) return fail('لا توجد سلسلة بهذا المعرّف.', 404)

  return NextResponse.json({
    ok: true,
    message: archive
      ? `أُرشفت «${data.title}» — اختفت عن الزائر وبقيت هنا`
      : `عادت «${data.title}» إلى الظهور`,
  })
}

/**
 * حذف نهائيّ للسلسلة ولقاءاتها.
 *
 * `?expect=<عدد اللقاءات>` إلزاميّ: هو العدد الذي رآه المشرف في نافذة
 * التأكيد. فلو أُضيف لقاء أو حُذف من نافذة أخرى بين لحظة العرض ولحظة
 * الضغط، رُفض الطلب بدل أن يمحو المشرف أكثر ممّا وافق عليه.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  if (!UUID.test(id)) return fail('معرّف السلسلة غير صالح.')

  const raw = new URL(request.url).searchParams.get('expect')
  const expect = Number(raw)
  if (raw === null || !Number.isInteger(expect) || expect < 0) {
    return fail('طلب الحذف ناقص. أعد تحميل الصفحة وحاول مرة أخرى.')
  }

  const { data: series, error: readErr } = await supabaseAdmin
    .from('series')
    .select('id, title')
    .eq('id', id)
    .maybeSingle()

  if (readErr) return fail('تعذّر الوصول إلى بيانات السلسلة.', 503)
  if (!series) return fail('لا توجد سلسلة بهذا المعرّف.', 404)

  const { count, error: cntErr } = await supabaseAdmin
    .from('lectures')
    .select('id', { count: 'exact', head: true })
    .eq('series_id', id)

  if (cntErr || count === null) return fail('تعذّر إحصاء لقاءات السلسلة.', 503)

  if (count !== expect) {
    return fail(
      `تغيّر عدد لقاءات هذه السلسلة (${count} لا ${expect}). أعد تحميل الصفحة وراجع قبل الحذف.`,
      409
    )
  }

  const { error: delErr } = await supabaseAdmin.from('series').delete().eq('id', id)
  if (delErr) return fail('تعذّر حذف السلسلة. حاول مرة أخرى.', 503)

  return NextResponse.json({
    ok: true,
    message: `حُذفت «${series.title}» و${count} من لقاءاتها نهائياً`,
  })
}
