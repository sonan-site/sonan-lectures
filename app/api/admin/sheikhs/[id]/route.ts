import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'

/**
 * تبديل نشاط الشيخ — إخفاءً وتنشيطاً.
 *
 * القاعدة ٦.٦: «الشيخ لا يُحذف. الإخفاء بـ`is_active = false`».
 * وأثر الإخفاء: يخرج من قائمة اختيار السلسلة ومن تصفية الزائر،
 * **وتبقى لقاءاته ظاهرة في «السابقة»** — فلا يُمسّ شيء من بياناته.
 *
 * ولا `DELETE` في هذا الملف عمداً: القيد `on delete restrict` في المخطط
 * يمنع حذف شيخٍ له سلسلة، والقاعدة تمنعه ولو لم تكن له سلسلة.
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
