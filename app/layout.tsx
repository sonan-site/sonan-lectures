import type { Metadata, Viewport } from 'next'
import { Tajawal } from 'next/font/google'
import './globals.css'

/**
 * خط Tajawal — يُستضاف محلياً بدل تحميله من Google في كل زيارة.
 * النتيجة البصرية مطابقة للنموذجين، بلا طلب خارجي يؤخّر العرض.
 */
const tajawal = Tajawal({
  // عربي فقط: النصّ اللاتيني الوحيد في النموذج هو الـslug داخل <code>
  // وهو على ui-monospace لا على Tajawal — فتنزل ملفات الخط المحمَّلة مسبقاً إلى النصف.
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-tajawal',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'اللقاءات العلمية · جمعية سنن',
  description: 'جدول اللقاءات والدروس العلمية في جمعية سنن التعليمية — بريدة، القصيم.',
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2A3F46',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body>{children}</body>
    </html>
  )
}
