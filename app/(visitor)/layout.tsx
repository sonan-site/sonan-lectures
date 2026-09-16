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
                // خلفية CSS لا عنصر <img>: object-fit:contain مع
                // width/height:100% لا يتقيّد بارتفاع الصندوق داخل هذا
                // التخطيط مهما حاولت (max-width/max-height، أو صريحة،
                // أو position:absolute — جُرِّبت الثلاث) فيرتفع الشعار
                // بنسبة عرضه دائماً ويُقتصّ. background-size:contain
                // يتقيّد بصندوقه بشكل صحيح دونها.
                <div
                  className="logoimg"
                  role="img"
                  aria-label="جمعية سنن التعليمية"
                  style={{
                    backgroundImage: `url(${settings.logo_url})`,
                    transform: `scale(${settings.logo_scale / 100})`,
                  }}
                />
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
        </div>
      </header>

      {children}

      <footer className="foot wrap">
        مقر جمعية سنن التعليمية · بريدة — القصيم
        <div className="tzchip">جميع الأوقات بتوقيت السعودية</div>
      </footer>
    </>
  )
}
