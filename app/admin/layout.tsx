import './admin.css'
import type { Metadata } from 'next'

/**
 * تخطيط لوحة التحكم — يحمل ورقة أنماطها وحدها.
 *
 * الحراسة ليست هنا عمداً: هذا التخطيط يلفّ `/admin/login` أيضاً، ولو حَرَس
 * لدارت الصفحة على نفسها. الحراسة في `app/admin/(panel)/layout.tsx` الذي
 * يلفّ الصفحات المحمية وحدها، فتُحرَس كل صفحة تُضاف إليها تلقائياً.
 */
export const metadata: Metadata = {
  title: 'لوحة التحكم · اللقاءات العلمية',
  // لوحة داخلية — لا تُفهرَس ولا تظهر في نتائج البحث
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
