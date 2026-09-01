'use client'

import { arNum, arPad2, countdown, minutesSince } from '@/lib/datetime'
import type { HeroVM } from '@/lib/view-model'
import { useNow } from './NowProvider'

/**
 * شريط البطل — منقول من `hero()` في النموذج المعتمد.
 *
 * يعرض اللقاء الجارِي إن وُجد، وإلا أقربَ قادم بعدّاد حيّ.
 * وصنف `is-live` على `.hero` نفسه هو ما يقلب لون وحدات العدّاد إلى التنبيهي.
 *
 * الحالة (`vm.status`) تأتي من `v_lectures`؛ ما يتحدّث هنا بالمؤقّت هو
 * الأرقام وحدها (القاعدتان ٦.١ و٦.٢).
 */
export function Hero({ vm }: { vm: HeroVM | null }) {
  const now = useNow()

  // الحالة الفارغة — القسم ٧: «لا لقاءات قادمة حالياً»
  if (!vm) {
    return (
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">اللقاءات العلمية</div>
          <h1>لا لقاءات قادمة حالياً</h1>
        </div>
      </section>
    )
  }

  const live = vm.status === 'live'
  const c = countdown(vm.startsAtMs, now)

  return (
    <section className={live ? 'hero is-live' : 'hero'}>
      <div className="wrap">
        <div className="eyebrow">{live ? 'يُبثّ الآن' : 'اللقاء القادم'}</div>
        <h1>{vm.title}</h1>
        {vm.book ? <div className="book">{vm.book}</div> : null}
        <div className="meta">
          {vm.sheikhName}
          <i>·</i>
          {vm.weekdayName} {vm.hijri}
          <i>·</i>
          {vm.time}
        </div>

        {live ? (
          <div className="livetag">
            <span className="dot" />
            جارٍ الآن — بدأ قبل {arNum(minutesSince(vm.startsAtMs, now))} دقيقة
          </div>
        ) : (
          <div className="clock">
            {c.days >= 1 ? (
              <div className="unit">
                <b>{arNum(c.days)}</b>
                <span>يوم</span>
              </div>
            ) : null}
            <div className="unit">
              <b>{arPad2(c.hours)}</b>
              <span>ساعة</span>
            </div>
            <div className="unit">
              <b>{arPad2(c.minutes)}</b>
              <span>دقيقة</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
