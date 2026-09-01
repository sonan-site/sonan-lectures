'use client'

import type { AdminSeriesVM } from '@/lib/admin-queries'

/**
 * تبويب السلاسل — منقول من `vSer()` في النموذج المعتمد.
 *
 * السلسلة وعاء الإدخال ولا تُعرض للزائر بذاتها (ADR-0001) — لكن لها صفحة
 * عامة `/s/<slug>` تُنشر عند إعلان الشرح، فالجدول يعرض رابطها وزرّ نسخ.
 *
 * ولا زرّ حذف: القسم ٥ لا يذكره، والنموذج المعتمد لا يحويه. والأثر الجانبي
 * ٨.٢ (حذف السلسلة يحذف لقاءاتها كلها) لا يقع ما دام الحذف غير معروض.
 */
export function SeriesTab({
  series,
  onNewSeries,
  onCopied,
}: {
  series: AdminSeriesVM[]
  onNewSeries: () => void
  onCopied: (message: string) => void
}) {
  async function copyLink(slug: string) {
    const url = `${window.location.origin}/s/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      onCopied('نُسخ الرابط')
    } catch {
      onCopied('تعذّر النسخ — انسخ الرابط يدوياً')
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <h2>السلاسل</h2>
          <p>الوعاء الذي يُدخَل مرة وتُولَّد منه اللقاءات</p>
        </div>
        <button className="btn p" onClick={onNewSeries}>
          ＋ سلسلة جديدة
        </button>
      </div>

      {series.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <b>لا سلاسل بعد</b>
            ابدأ بإنشاء سلسلة، ولو كانت لقاءً واحداً.
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th>السلسلة</th>
                  <th>الشيخ</th>
                  <th>النوع</th>
                  <th>عدد اللقاءات</th>
                  <th>رابط الصفحة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="tt">{s.title}</span>
                      {s.book ? <span className="sub">{s.book}</span> : null}
                    </td>
                    <td>{s.sheikhName}</td>
                    <td>
                      <span className={`chip ${s.typeClass}`}>{s.typeLabel}</span>
                    </td>
                    <td style={{ fontWeight: 800 }}>{s.countAr}</td>
                    <td
                      dir="ltr"
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: 12.5,
                        color: 'var(--brown)',
                      }}
                    >
                      /s/{s.slug}
                    </td>
                    <td>
                      <button className="btn g sm" onClick={() => copyLink(s.slug)}>
                        نسخ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
