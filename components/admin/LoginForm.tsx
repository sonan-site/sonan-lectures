'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * نموذج الدخول — حقل كلمة مرور واحد (القسم ٥).
 *
 * الكلمة تُرسَل مرة واحدة إلى `/api/admin/login` ولا تُحفظ في أي حالة تبقى
 * بعد الإرسال. والخادم هو من يقارن ويُصدر الكوكي، فلا تصل الواجهة قيمةٌ
 * تُشتقّ منها الكلمة.
 *
 * ورسائل الخطأ كلها عربية جاهزة من الخادم، بما فيها مدّة الانتظار بعد
 * المحاولات الفاشلة — فلا يظهر نصّ إنجليزي للمستخدم (القسم ٧).
 */
export function LoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        setPassword('')
        // replace لا push: صفحة الدخول لا تبقى في سجلّ التصفّح خلف اللوحة
        router.replace('/admin')
        router.refresh()
        return
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'تعذّر تسجيل الدخول. حاول مرة أخرى.')
    } catch {
      setError('تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="panel">
        <div className="ph2">تسجيل الدخول</div>
        <div className="pb">
          {error ? (
            <p className="loginerr" role="alert">
              {error}
            </p>
          ) : null}

          <div className="f">
            <label htmlFor="pw">كلمة المرور</label>
            <input
              id="pw"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              dir="ltr"
            />
            <p className="hint">كلمة مرور واحدة للوحة كلها · تُغيَّر من إعدادات Vercel</p>
          </div>

          <button className="btn p" type="submit" disabled={busy || password.length === 0}>
            {busy ? 'جارٍ التحقّق…' : 'دخول'}
          </button>
        </div>
      </div>
    </form>
  )
}
