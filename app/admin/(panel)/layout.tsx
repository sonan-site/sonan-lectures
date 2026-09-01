import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifySession } from '@/lib/server/auth'
import { getSettings } from '@/lib/queries'
import { LogoutButton } from '@/components/admin/LogoutButton'

/**
 * الحارس — كل صفحة تحت هذا التخطيط محميّة.
 *
 * وضعُ الحراسة في تخطيط مجموعة المسارات لا في كل صفحة يعني أن أي صفحة
 * تُضاف لاحقاً تُحرَس تلقائياً، فلا يُنسى الحارس على واحدة.
 *
 * التحقّق من الكوكي وحده لا يكفي حاجزاً أمام الكتابة: كل كتابة تمرّ عبر
 * معالج مسار يفحص الكوكي بنفسه ثم يكتب بمفتاح الخدمة (القاعدة ٦.٥).
 * هذا الحارس يحمي **العرض**، وذاك يحمي **الأثر**.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  if (!verifySession(jar.get(ADMIN_COOKIE)?.value)) redirect('/admin/login')

  let logo: string | null = null
  try {
    logo = (await getSettings()).logo_url
  } catch {
    logo = null
  }

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <div className="logo">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="سنن" />
              ) : (
                <span className="ph" style={{ display: 'grid' }}>
                  الشعار
                </span>
              )}
            </div>
            <div>
              <b>لوحة التحكم</b>
              <span>اللقاءات العلمية · جمعية سنن</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      {children}
    </>
  )
}
