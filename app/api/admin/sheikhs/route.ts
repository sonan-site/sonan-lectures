import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'
import { ValidationError, requiredSlug, requiredText } from '@/lib/server/validate'

/**
 * إضافة شيخ.
 *
 * الشيخ كيان مستقل يُضاف مرة ويُختار من قائمة (ADR-0001)، وعليه تُبنى صفحته
 * العامة `/sheikh/<slug>` والتصفية باسمه.
 *
 * ولا حذف هنا ولا في أي مكان: القاعدة ٦.٦ تجعل الإخفاء بديلاً عن الحذف،
 * والقيد `on delete restrict` في المخطط يمنعه أصلاً.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('طلب غير صالح.')
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

  const { error } = await supabaseAdmin.from('sheikhs').insert({ name, slug, is_active: true })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('sheikhs_slug_key') || msg.includes('duplicate key')) {
      return fail('هذا الرابط مستخدم لشيخ آخر. اختر رابطاً غيره.', 409)
    }
    if (msg.includes('sheikhs_slug_format')) {
      return fail('رابط صفحته: حروف لاتينية صغيرة وأرقام وشُرَط فقط.', 422)
    }
    return fail('تعذّر إضافة الشيخ. حاول مرة أخرى.', 503)
  }

  return NextResponse.json({ ok: true })
}
