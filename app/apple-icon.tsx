import { renderPwaIcon } from '@/lib/pwa-icon'

/**
 * `apple-touch-icon` — iOS لا يقرأ أيقونة الـmanifest بشكل موثوق، ويشترط
 * هذا الوسم رابطاً ثابتاً في رأس الصفحة وقت التحميل (القسم الفني في
 * الإحاطة). ملف باسم `apple-icon` تحت `app/` اصطلاح ينشئه Next.js
 * تلقائياً في `<head>` لكل صفحة، دون تدخّل يدوي في `app/layout.tsx`.
 *
 * ١٨٠×١٨٠ هو المقاس الذي توصي به وثائق Apple لأحدث الأجهزة.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AppleIcon() {
  return renderPwaIcon(180)
}
