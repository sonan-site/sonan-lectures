import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifySession } from '@/lib/server/auth'
import { getSettings } from '@/lib/queries'
import { LoginForm } from '@/components/admin/LoginForm'

/**
 * صفحة الدخول — خارج نطاق الحراسة عمداً.
 * ومن كانت جلسته سارية لا يراها: يُحوَّل إلى اللوحة مباشرة.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LoginPage() {
  const jar = await cookies()
  if (verifySession(jar.get(ADMIN_COOKIE)?.value)) redirect('/admin')

  // الشعار من الإعدادات — وتعثّر قاعدة البيانات لا يمنع الدخول
  let logo: string | null = null
  try {
    logo = (await getSettings()).logo_url
  } catch {
    logo = null
  }

  return (
    <div className="loginpage">
      <div className="loginbox">
        <div className="loginhead">
          <div className="logo">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="جمعية سنن التعليمية" />
            ) : (
              <span className="ph" style={{ display: 'grid' }}>
                الشعار
              </span>
            )}
          </div>
          <b>لوحة التحكم</b>
          <span>اللقاءات العلمية · جمعية سنن</span>
        </div>

        <LoginForm />

        <p className="loginfoot">هذه الصفحة للمشرف وحده. الجدول العام لا يحتاج تسجيل دخول.</p>
      </div>
    </div>
  )
}
