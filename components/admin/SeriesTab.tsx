'use client'

import { useState } from 'react'
import type { AdminSeriesVM } from '@/lib/admin-queries'
import { ConfirmDialog, callOrThrow } from './ConfirmDialog'

/**
 * تبويب السلاسل — منقول من `vSer()` في النموذج المعتمد.
 *
 * السلسلة وعاء الإدخال ولا تُعرض للزائر بذاتها (ADR-0001) — لكن لها صفحة
 * عامة `/s/<slug>` تُنشر عند إعلان الشرح، فالجدول يعرض رابطها وزرّ نسخ.
 *
 * ⚠️ **أرشفة وحذف مُضافان بعد هجرة ٠٠٢** — نقض صريح لتخطيط القسم ٥ الأصلي،
 * بموافقة صاحب المشروع. الفرق بينهما جوهريّ:
 *   · الأرشفة تُخفي السلسلة ولقاءاتها عن الزائر، وتُلغى بضغطة. لما انتهى
 *     ولا يُراد عرضه بعد.
 *   · الحذف نهائيّ ويأخذ لقاءاتها معه (الأثر الجانبي ٨.٢) — لخطأ الإدخال.
 *
 * والمؤرشفة مخفيّة افتراضاً هنا أيضاً؛ مفتاح «إظهار المؤرشف» يكشفها.
 */
export function SeriesTab({
  series,
  onNewSeries,
  onCopied,
  onDone,
}: {
  series: AdminSeriesVM[]
  onNewSeries: () => void
  onCopied: (message: string) => void
  onDone: (message: string) => void
}) {
  const [showArchived, setShowArchived] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AdminSeriesVM | null>(null)

  const visible = series.filter((s) => showArchived || !s.isArchived)
  const archivedCount = series.filter((s) => s.isArchived).length

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/s/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      onCopied('نُسخ الرابط')
    } catch {
      onCopied('تعذّر النسخ — انسخ الرابط يدوياً')
    }
  }

  async function toggleArchive(s: AdminSeriesVM) {
    if (busyId) return
    setBusyId(s.id)
    setError(null)
    try {
      const data = await callOrThrow(`/api/admin/series/${s.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: s.isArchived ? 'restore' : 'archive' }),
      })
      onDone(data.message ?? 'حُفظ التغيير')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر حفظ التغيير.')
    } finally {
      setBusyId(null)
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

      {error ? (
        <p className="loginerr" role="alert">
          {error}
        </p>
      ) : null}

      {series.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <b>لا سلاسل بعد</b>
            ابدأ بإنشاء سلسلة، ولو كانت لقاءً واحداً.
          </div>
        </div>
      ) : (
        <div className="panel">
          {archivedCount > 0 ? (
            <div className="ph2">
              <span>
                {showArchived ? 'كل السلاسل' : 'السلاسل الظاهرة'}
              </span>
              <label className="sw">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                إظهار المؤرشف ({archivedCount})
              </label>
            </div>
          ) : null}

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
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className={s.isArchived ? 'off' : ''}>
                    <td>
                      <span className="tt">{s.title}</span>
                      {s.book ? <span className="sub">{s.book}</span> : null}
                      {s.isArchived ? (
                        <span className="chip ina" style={{ marginTop: 4 }}>
                          مؤرشفة
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {s.sheikhName}
                      {s.sheikhTemplateGone ? <span className="sub">قالبه محذوف</span> : null}
                    </td>
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
                    <td>
                      <button
                        className="btn g sm"
                        disabled={busyId === s.id}
                        onClick={() => toggleArchive(s)}
                      >
                        {busyId === s.id ? '…' : s.isArchived ? 'استرجاع' : 'أرشفة'}
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn d sm"
                        disabled={busyId === s.id}
                        onClick={() => setToDelete(s)}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        title="حذف السلسلة نهائياً"
        confirmLabel="حذف السلسلة ولقاءاتها"
        danger
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          const data = await callOrThrow(
            `/api/admin/series/${toDelete.id}?expect=${toDelete.count}`,
            { method: 'DELETE' }
          )
          setToDelete(null)
          onDone(data.message ?? 'حُذفت السلسلة')
        }}
        body={
          toDelete ? (
            <>
              حذف <b>«{toDelete.title}»</b> نهائياً، مع{' '}
              <b>{toDelete.countAr}</b> من لقاءاتها — كلها، لا رجعة فيه.
              <br />
              <br />
              إن كان الغرض إخفاءها فقط وتبقى قابلة للاسترجاع، استعمل «أرشفة» بدلاً من الحذف.
            </>
          ) : null
        }
      />
    </>
  )
}
