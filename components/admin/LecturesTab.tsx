'use client'

import { useState } from 'react'
import { arNum } from '@/lib/datetime'
import type { AdminLectureVM, AdminSeriesVM } from '@/lib/admin-queries'
import { ConfirmDialog, callOrThrow } from './ConfirmDialog'
import {
  ArchiveIcon,
  CalendarIcon,
  DeleteIcon,
  EditIcon,
  PersonIcon,
  RestoreIcon,
} from './ActionIcons'

/**
 * تبويب اللقاءات — منقول من `vLec()` في النموذج المعتمد.
 *
 * جدول بتصفية (السلسلة · قادم/سابق)، وأزرار «تعديل» و«أرشفة» و«حذف»
 * لكل لقاء. واللقاء الذي خرج عن سلسلته يُوسم بـ«مختلف عن السلسلة».
 *
 * الحالة تأتي من `v_lectures_admin` ولا تُحسب هنا (القاعدة ٦.١). وما يُقرَّر
 * محلياً هو **الوعاء** وحده: هل يظهر تحت «القادمة» أم «السابقة» — واللقاء
 * الملغى حالته `cancelled` سواء كان موعده غداً أو قبل شهر، فيُرجَع إلى موعده.
 *
 * ⚠️ **ثلاث حالات لا تُخلَط** (أُضيفت بعد هجرة ٠٠٢):
 *   · ملغى — يبقى ظاهراً للزائر مشطوباً وعدّاده متوقّف (القاعدة ٦.٧ كما هي).
 *   · مؤرشف — يختفي عن الزائر تماماً، ويُسترجَع بضغطة.
 *   · محذوف — نهائيّ، وتُعاد ترقيم ما بعده تلقائياً.
 * والمؤرشف مخفيّ افتراضاً في هذا الجدول أيضاً؛ مفتاح «إظهار المؤرشف» يكشفه.
 *
 * ⚠️ **دون ٨٢٠px يتحوّل الجدول إلى بطاقات** (`.lec-cards`)، لا يُمرَّر أفقياً.
 * القرار على مسوَّدة Artifact قارنت بديلَين — بطاقات مقابل عمود مثبَّت — واعتُمدت
 * البطاقات لأن الجدول المزدحم بثمانية أعمدة كان يحتاج تمريراً أفقياً على أي
 * عرض، وهذا نمط "تطبيق ويب" لا تطبيق مثبَّت. البطاقة والجدول يُصيَّران معاً
 * دائماً وCSS تختار الظاهر منهما — القياس بجافاسكربت كان يُنتج اختلافاً بين
 * تصيير الخادم وأول تصيير في المتصفح.
 */

/** صنف شارة الحالة كما في النموذج: الملغى والجارِي بالأحمر، وما عداهما محايد */
const STATUS_CHIP: Record<string, string> = {
  upcoming: '',
  live: 'no',
  done: '',
  cancelled: 'no',
}

export function LecturesTab({
  lectures,
  series,
  serverNow,
  onEdit,
  onNewSeries,
  onDone,
}: {
  lectures: AdminLectureVM[]
  series: AdminSeriesVM[]
  serverNow: number
  onEdit: (id: string) => void
  onNewSeries: () => void
  onDone: (message: string) => void
}) {
  const [seriesId, setSeriesId] = useState('')
  const [when, setWhen] = useState<'up' | 'past'>('up')
  const [showArchived, setShowArchived] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AdminLectureVM | null>(null)

  const isUpcoming = (l: AdminLectureVM) =>
    l.status === 'upcoming' || l.status === 'live'
      ? true
      : l.status === 'cancelled'
        ? l.startsAtMs > serverNow
        : false

  const archivedCount = lectures.filter((l) => l.isArchived || l.seriesArchived).length

  const list = lectures
    .filter((l) => (seriesId ? l.seriesId === seriesId : true))
    .filter((l) => (when === 'up' ? isUpcoming(l) : !isUpcoming(l)))
    .filter((l) => showArchived || (!l.isArchived && !l.seriesArchived))
    .sort((a, b) => (when === 'up' ? a.startsAtMs - b.startsAtMs : b.startsAtMs - a.startsAtMs))

  async function toggleArchive(l: AdminLectureVM) {
    if (busyId) return
    setBusyId(l.id)
    setError(null)
    try {
      const data = await callOrThrow(`/api/admin/lectures/${l.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: l.isArchived ? 'restore' : 'archive' }),
      })
      onDone(data.message ?? 'حُفظ التغيير')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر حفظ التغيير.')
    } finally {
      setBusyId(null)
    }
  }

  /** أزرار الإجراءات — مصدر واحد، يُستعمل في الجدول والبطاقة معاً */
  function Actions({ l }: { l: AdminLectureVM }) {
    return (
      <>
        <button
          className="btn g icon"
          title="تعديل"
          aria-label="تعديل"
          onClick={() => onEdit(l.id)}
        >
          <EditIcon />
        </button>
        <button
          className="btn g icon"
          disabled={busyId === l.id || l.seriesArchived}
          title={
            l.seriesArchived
              ? 'أرشِف اللقاء من تبويب السلاسل'
              : l.isArchived
                ? 'استرجاع'
                : 'أرشفة'
          }
          aria-label={l.isArchived ? 'استرجاع' : 'أرشفة'}
          onClick={() => toggleArchive(l)}
        >
          {l.isArchived ? <RestoreIcon /> : <ArchiveIcon />}
        </button>
        <button
          className="btn d icon"
          disabled={busyId === l.id}
          title="حذف"
          aria-label="حذف"
          onClick={() => setToDelete(l)}
        >
          <DeleteIcon />
        </button>
      </>
    )
  }

  function StatusChips({ l }: { l: AdminLectureVM }) {
    return (
      <>
        <span className={`chip ${l.effTypeClass}`}>{l.effTypeLabel}</span>
        <span className={`chip ${STATUS_CHIP[l.status] ?? ''}`.trimEnd()}>{l.statusLabel}</span>
        {l.isOverridden ? <span className="chip ov">مختلف عن السلسلة</span> : null}
        {l.isArchived || l.seriesArchived ? (
          <span className="chip ina">
            {l.seriesArchived && !l.isArchived ? 'سلسلته مؤرشفة' : 'مؤرشف'}
          </span>
        ) : null}
      </>
    )
  }

  return (
    <>
      <div className="head">
        <div>
          <h2>اللقاءات</h2>
          <p>
            {arNum(lectures.length)} لقاءً في {arNum(series.length)} سلاسل · التعديل هنا يخصّ اللقاء
            وحده
          </p>
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

      <div className="panel">
        <div className="ph2">
          <span>قائمة اللقاءات</span>
          <span className="filters">
            {archivedCount > 0 ? (
              <label className="sw">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                إظهار المؤرشف ({arNum(archivedCount)})
              </label>
            ) : null}
            <select
              aria-label="تصفية بالسلسلة"
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
            >
              <option value="">كل السلاسل</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <select
              aria-label="قادم أو سابق"
              value={when}
              onChange={(e) => setWhen(e.target.value as 'up' | 'past')}
            >
              <option value="up">القادمة</option>
              <option value="past">السابقة</option>
            </select>
          </span>
        </div>

        {list.length === 0 ? (
          <div className="tblwrap">
            <div className="empty">
              <b>لا لقاءات في هذا العرض</b>
              غيّر التصفية أو أنشئ سلسلة جديدة.
            </div>
          </div>
        ) : (
          <>
            {/* الجدول — من ٨٢٠px فما فوق */}
            <div className="tblwrap lec-desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>الترتيب</th>
                    <th>اللقاء</th>
                    <th>الشيخ</th>
                    <th>الموعد</th>
                    <th>المدة</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((l) => (
                    <tr key={l.id} className={l.isCancelled ? 'off' : ''}>
                      <td style={{ fontWeight: 800, color: 'var(--brown)' }}>{l.ordAr}</td>
                      <td>
                        <span className="tt">{l.seriesTitle}</span>
                        {l.seriesBook ? <span className="sub">{l.seriesBook}</span> : null}
                        {l.isOverridden ? (
                          <span className="chip ov" style={{ marginTop: 4 }}>
                            مختلف عن السلسلة
                          </span>
                        ) : null}
                        {l.isArchived || l.seriesArchived ? (
                          <span className="chip ina" style={{ marginTop: 4 }}>
                            {l.seriesArchived && !l.isArchived ? 'سلسلته مؤرشفة' : 'مؤرشف'}
                          </span>
                        ) : null}
                      </td>
                      <td>{l.sheikhName}</td>
                      <td>
                        {l.hijri}
                        <span className="sub">
                          {l.weekdayName} · {l.time}
                        </span>
                      </td>
                      <td>{l.effDurationAr} د</td>
                      <td>
                        <span className={`chip ${l.effTypeClass}`}>{l.effTypeLabel}</span>
                      </td>
                      <td>
                        <span className={`chip ${STATUS_CHIP[l.status] ?? ''}`.trimEnd()}>
                          {l.statusLabel}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <Actions l={l} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* البطاقات — دون ٨٢٠px */}
            <div className="lec-cards">
              {list.map((l) => (
                <div key={l.id} className={`lec-card${l.isCancelled ? ' cancelled' : ''}`}>
                  <div className="row1">
                    <div className="titles">
                      <span className="tt">{l.seriesTitle}</span>
                      {l.seriesBook ? <span className="bk">{l.seriesBook}</span> : null}
                    </div>
                    <span className="ord">{l.ordAr}</span>
                  </div>

                  <div className="sheikh">
                    <PersonIcon />
                    <span>{l.sheikhName}</span>
                  </div>

                  <div className="chips">
                    <StatusChips l={l} />
                  </div>

                  <div className="foot-row">
                    <div className="when">
                      <CalendarIcon />
                      <b>{l.weekdayName}</b>
                      <span className="dash">·</span>
                      <span>
                        {l.hijri} · {l.time}
                      </span>
                    </div>
                    <div className="actions">
                      <Actions l={l} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        title="حذف اللقاء نهائياً"
        confirmLabel="حذف اللقاء"
        danger
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          const data = await callOrThrow(`/api/admin/lectures/${toDelete.id}`, {
            method: 'DELETE',
          })
          setToDelete(null)
          onDone(data.message ?? 'حُذف اللقاء')
        }}
        body={
          toDelete ? (
            <>
              حذف اللقاء رقم <b>{toDelete.ordAr}</b> من <b>«{toDelete.seriesTitle}»</b> — بموعد{' '}
              {toDelete.hijri}. لا رجعة فيه، وسيُعاد ترقيم ما بعده تلقائياً.
              <br />
              <br />
              إن كان الغرض إخفاءه فقط وتبقى قابلاً للاسترجاع، استعمل «أرشفة» بدلاً من الحذف.
            </>
          ) : null
        }
      />
    </>
  )
}
