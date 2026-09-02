import { renderPwaIcon } from '@/lib/pwa-icon'

/**
 * أيقونة PWA بمقاس مطلوب — تُولَّد من الشعار المرفوع في الإعدادات
 * (`settings.logo_url`)، لا من رفع منفصل.
 *
 * القياسات المسموحة محصورة عمداً: ١٩٢ و٥١٢ لِـ`manifest.webmanifest`.
 * أي رقم آخر ⇐ ٤٠٤ — لا توليد بمقاس اعتباطي.
 *
 * ⚠️ لا شعار مرفوع بعد ⇐ حرف «س» على خلفية بترولية (لون الهوية)، حتى
 * لا تفشل الأيقونة أو تُعرض بيضاء لمن يثبّت المنصة قبل رفع الشعار
 * (`lib/pwa-icon.tsx` يحمل هذا الاحتياط).
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED = new Set([192, 512])

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params
  const size = Number(raw)
  if (!ALLOWED.has(size)) {
    return new Response('مقاس أيقونة غير مدعوم.', { status: 404 })
  }
  return renderPwaIcon(size)
}
