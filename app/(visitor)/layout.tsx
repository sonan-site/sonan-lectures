import './visitor.css'
import { getSettings } from '@/lib/queries'

/**
 * تخطيط واجهة الزائر — الترويسة والتذييل المشتركان بين `/` و`/sheikh/[slug]`
 * و`/s/[slug]`، وورقة أنماط النموذج المعتمد.
 *
 * القاعدة ٦.٢: هذه الشجرة تقرأ من قاعدة البيانات وتُصيَّر عند كل طلب.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VisitorLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <div className="logo">
              {settings.logo_url ? (
                // عنصر <img> عادي عمداً: أصناف الورقة
                // (max-width/max-height/object-fit) تفترض العنصر نفسه،
                // وغلاف next/image يكسر مقاس ١٥٠×٦٠ المعتمد.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logo_url} alt="جمعية سنن التعليمية" />
              ) : (
                <span className="ph" style={{ display: 'grid' }}>
                  مساحة الشعار
                  <br />
                  يُرفع من اللوحة
                </span>
              )}
            </div>
            <div className="sep" />
            {/* ⚠️ آخر ابن في .brand — قاعدة .brand>div:last-child{min-width:0}
                معلّقة بموقعه، وأي غلاف إضافي يُفقدها أثرها فيفيض النصّ أفقياً */}
            <div>
              <b>اللقاءات العلمية</b>
              <span>جمعية سنن التعليمية · بريدة</span>
            </div>
          </div>
          <div className="tzchip">جميع الأوقات بتوقيت السعودية</div>
        </div>
      </header>

      {children}

      <footer className="foot wrap">مقر جمعية سنن التعليمية · بريدة — القصيم</footer>
    </>
  )
}
