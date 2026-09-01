'use client'

import { useState } from 'react'
import { arNum } from '@/lib/datetime'
import type { AdminLectureVM, AdminSeriesVM } from '@/lib/admin-queries'

/**
 * تبويب اللقاءات — منقول من `vLec()` في النموذج المعتمد.
 *
 * جدول بتصفية (السلسلة · قادم/سابق)، وزرّ «تعديل» لكل لقاء.
 * واللقاء الذي خرج عن سلسلته يُوسم بـ«مختلف عن السلسلة».
 *
 * الحالة تأتي من `v_lectures` ولا تُحسب هنا (القاعدة ٦.١). وما يُقرَّر محلياً
 * هو **الوعاء** وحده: هل يظهر تحت «القادمة» أم «السابقة» — واللقاء الملغى
 * حالته `cancelled` سواء كان موعده غداً أو قبل شهر، فيُرجَع إلى موعده.
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
}: {
  lectures: AdminLectureVM[]
  series: AdminSeriesVM[]
  serverNow: number
  onEdit: (id: string) => void
  onNewSeries: () => void
}) {
  const [seriesId, setSeriesId] = useState('')
  const [when, setWhen] = useState<'up' | 'past'>('up')

  const isUpcoming = (l: AdminLectureVM) =>
    l.status === 'upcoming' || l.status === 'live'
      ? true
      : l.status === 'cancelled'
        ? l.startsAtMs > serverNow
        : false

  const list = lectures
    .filter((l) => (seriesId ? l.seriesId === seriesId : true))
    .filter((l) => (when === 'up' ? isUpcoming(l) : !isUpcoming(l)))
    .sort((a, b) => (when === 'up' ? a.startsAtMs - b.startsAtMs : b.startsAtMs - a.startsAtMs))

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

      <div className="panel">
        <div className="ph2">
          <span>قائمة اللقاءات</span>
          <span className="filters">
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

        <div className="tblwrap">
          {list.length === 0 ? (
            <div className="empty">
              <b>لا لقاءات في هذا العرض</b>
              غيّر التصفية أو أنشئ سلسلة جديدة.
            </div>
          ) : (
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
                  <th />
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
                      <button className="btn g sm" onClick={() => onEdit(l.id)}>
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
