import Link from 'next/link'

/**
 * حالة الفشل: `slug` غير موجود (القسم ٧).
 * المطلوب: صفحة ٤٠٤ عربية فيها رابط للصفحة الرئيسية.
 */
export const metadata = { title: 'الصفحة غير موجودة · جمعية سنن' }

export default function NotFound() {
  return (
    <div className="failpage">
      <div className="failcard">
        <div className="failmark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5L21 21" />
          </svg>
        </div>
        <h1>هذه الصفحة غير موجودة</h1>
        <p>
          الرابط الذي فتحته لا يقابل شيخاً ولا سلسلة في المنصة. قد يكون الرابط قديماً أو فيه خطأ
          إملائي.
        </p>
        <div className="failacts">
          <Link className="failbtn p" href="/">
            العودة إلى جدول اللقاءات
          </Link>
        </div>
      </div>
    </div>
  )
}
