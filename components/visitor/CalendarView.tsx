'use client'

import { useMemo, useState } from 'react'
import { arNum, hijriMonthShift } from '@/lib/datetime'
import { buildMonthVM, type LectureVM, type MonthVM } from '@/lib/view-model'

/**
 * تبويب التقويم — شبكة شهر هجري، منقول من `calendar()` في النموذج المعتمد.
 *
 * اليوم الذي فيه لقاء يُعلَّم، والنقر يفتح تفاصيل لقاءات ذلك اليوم.
 * ولا تُعرض كل الحقول داخل الخلية: مؤشّران بحدّ أقصى ثم «+ن».
 *
 * ⚠️ شهر البداية يأتي مبنيّاً من الخادم (`initialMonth`) فيتطابق أول تصيير
 * مع HTML الخادم حرفاً بحرف. ولا تُستدعى `Intl` في المتصفح إلا بعد أن ينتقل
 * الزائر إلى شهر آخر — ولا مقابل خادمياً لذلك الشهر، فلا مقارنة ترطيب.
 *
 * ⚠️ سهما التنقّل: «السابق» يشير يميناً و«التالي» يساراً — وهذا هو الصحيح
 * في RTL. لا تُصحّحهما ولا تستبدلهما بمكتبة أيقونات ولا تقلبهما بـscaleX.
 */

const WEEK_HEADS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export function CalendarView({
  rows,
  initialMonth,
  todayKey,
  onOpenDay,
}: {
  /** كل اللقاءات في نطاق الصفحة — التقويم لا يتأثّر بتصفية الجدول */
  rows: LectureVM[]
  initialMonth: MonthVM
  todayKey: string
  onOpenDay: (dayKey: string) => void
}) {
  const [anchorMs, setAnchorMs] = useState(initialMonth.anchorMs)

  // ما دامت المرساة هي مرساة الخادم، نستعمل شهره كما هو — فلا Intl في المتصفح
  const month = anchorMs === initialMonth.anchorMs ? initialMonth : buildMonthVM(anchorMs)

  const byDay = useMemo(() => {
    const map = new Map<string, LectureVM[]>()
    for (const vm of rows) {
      const list = map.get(vm.dayKey)
      if (list) list.push(vm)
      else map.set(vm.dayKey, [vm])
    }
    return map
  }, [rows])

  const shift = (delta: -1 | 1) => setAnchorMs(hijriMonthShift(anchorMs, delta).getTime())

  return (
    <>
      <div className="calhead">
        <button className="nav" aria-label="الشهر السابق" onClick={() => shift(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <b>{month.title}</b>
        <button className="nav" aria-label="الشهر التالي" onClick={() => shift(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>

      <div className="grid">
        {WEEK_HEADS.map((h) => (
          <div className="gh" key={h}>
            {h}
          </div>
        ))}

        {Array.from({ length: month.lead }, (_, i) => (
          <div className="cell pad" key={`pad-${i}`} />
        ))}

        {month.days.map((day) => {
          const list = byDay.get(day.dayKey) ?? []
          const has = list.length > 0
          const classes = ['cell', has ? 'has' : '', day.dayKey === todayKey ? 'today' : '']
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={day.dayKey}
              className={classes}
              disabled={!has}
              onClick={has ? () => onOpenDay(day.dayKey) : undefined}
            >
              <span className="n">{day.dayAr}</span>
              {list.slice(0, 2).map((vm) => (
                <span key={vm.id} className={`pill ${vm.pillClass}`.trimEnd()}>
                  {vm.title}
                </span>
              ))}
              {list.length > 2 ? <div className="more">+{arNum(list.length - 2)}</div> : null}
            </button>
          )
        })}
      </div>

      <div className="callegend">
        <span>
          <i style={{ background: '#2A3F46' }} />
          لقاء قادم
        </span>
        <span>
          <i style={{ background: '#C2452D' }} />
          جارٍ الآن
        </span>
        <span>
          <i style={{ background: '#CFC7BC' }} />
          منتهٍ
        </span>
        <span>
          <i style={{ background: '#8C847D' }} />
          ملغى
        </span>
      </div>
    </>
  )
}
