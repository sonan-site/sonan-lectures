'use client'

import Link from 'next/link'
import { arNum, arPad2, countdown } from '@/lib/datetime'
import type { LectureVM } from '@/lib/view-model'
import { useNow } from './NowProvider'

/**
 * رأس صفحة السلسلة — منقول من `serHead()` في النموذج المعتمد.
 *
 * القسم ٥: «صفحة السلسلة: رأس تعريفي وشريط تقدّم، ثم لقاءاتها».
 *
 * ونصّ «أُنجز» هنا هو ما يفحصه معيار القبول ٩.
 */
export function SeriesHead({
  title,
  book,
  sheikhName,
  lectures,
}: {
  title: string
  book: string | null
  sheikhName: string
  /** كل لقاءات السلسلة مرتّبةً بترتيبها */
  lectures: LectureVM[]
}) {
  const now = useNow()

  const total = lectures.length
  const done = lectures.filter((l) => l.status === 'done').length
  // القسمة على صفر لو كانت السلسلة بلا لقاءات — حالة ممكنة لو حُذفت مواعيدها كلها
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  /**
   * ⚠️ «اللقاء القادم» يُختار بالأقرب زمناً لا بترتيب `ord`.
   *
   * `getLecturesBySeriesId` يرتّب بـ`ord`، وقد أُسقط وسم «أُجّل» فصار التأجيل
   * تعديلَ تاريخٍ وحده — فلقاءٌ ترتيبه ٤ قد يقع بعد السادس زمنياً. الاختيار
   * بالترتيب حينئذٍ يعرض عدّاداً لموعد بعيد بينما اللقاء الحقيقي القادم غداً.
   * والنموذج المعتمد يرتّب بالبداية قبل الاختيار (`serHead()` في prototype).
   */
  const next = [...lectures]
    .sort((a, b) => a.startsAtMs - b.startsAtMs)
    .find((l) => l.status === 'upcoming' || l.status === 'live')

  let nextIn: React.ReactNode
  if (next && next.status === 'live') {
    nextIn = (
      <div className="nextin">
        <span className="state live">
          <span className="dot" />
          جارٍ الآن
        </span>
      </div>
    )
  } else if (next) {
    const c = countdown(next.startsAtMs, now)
    nextIn = (
      <div className="nextin">
        اللقاء القادم بعد{' '}
        <b>{c.days >= 1 ? `${arNum(c.days)} يوم` : `${arPad2(c.hours)}:${arPad2(c.minutes)} ساعة`}</b>
      </div>
    )
  } else {
    nextIn = <div className="nextin">اكتمل هذا الشرح</div>
  }

  return (
    <>
      <Link className="backlink" href="/">
        → كل اللقاءات
      </Link>
      <div className="serhead">
        <h2>{title}</h2>
        {book ? <div className="bk">{book}</div> : null}
        <div className="sh">{sheikhName}</div>
        <div className="prog">
          <div className="track">
            <i style={{ width: `${percent}%` }} />
          </div>
          <p>
            أُنجز {arNum(done)} من {arNum(total)} {total > 10 ? 'لقاءً' : 'لقاءات'}
          </p>
        </div>
        {nextIn}
      </div>
    </>
  )
}
