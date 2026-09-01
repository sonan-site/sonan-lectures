'use client'

/**
 * حالة الفشل: قاعدة البيانات لا تستجيب (القسم ٧).
 *
 * المطلوب صراحةً: صفحة خطأ عربية مفهومة — لا شاشة بيضاء ولا نصّ إنجليزي.
 * لذلك لا نعرض `error.message` للزائر إلا إن كان خطأً عربياً صغناه نحن
 * في `DbError`؛ وما عداه يبقى في سجلّ الخادم ولا يظهر على الشاشة.
 */

import { useEffect } from 'react'

const ARABIC = /[؀-ۿ]/

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // يُسجَّل في وحدة التحكم وسجلّ Vercel — لا على شاشة الزائر
    console.error('[sonan-lectures]', error)
  }, [error])

  const friendly = ARABIC.test(error.message)
    ? error.message
    : 'تعذّر الوصول إلى بيانات اللقاءات. قد تكون المشكلة مؤقّتة.'

  return (
    <div className="failpage">
      <div className="failcard">
        <div className="failmark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.01" />
          </svg>
        </div>
        <h1>تعذّر عرض اللقاءات</h1>
        <p>{friendly}</p>
        <div className="failacts">
          <button className="failbtn p" onClick={reset}>
            إعادة المحاولة
          </button>
          <a className="failbtn g" href="/">
            الصفحة الرئيسية
          </a>
        </div>
        {error.digest ? <code className="faildigest">رمز العطل: {error.digest}</code> : null}
      </div>
    </div>
  )
}
