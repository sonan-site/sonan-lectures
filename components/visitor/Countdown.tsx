'use client'

import { arNum, arPad2, countdown } from '@/lib/datetime'
import type { LectureVM } from '@/lib/view-model'
import { useNow } from './NowProvider'

/**
 * عمود العدّاد — منقول من `cdHTML` في النموذج المعتمد.
 *
 * يعرض الأيام وحدها متى بقي أكثر من ٢٤ ساعة، ويتحوّل إلى «ساعة:دقيقة»
 * بلون تنبيهي (`.cd.soon`) دون ذلك.
 */
export function Countdown({ startsAtMs }: { startsAtMs: number }) {
  const now = useNow()
  const c = countdown(startsAtMs, now)

  if (!c.soon) {
    return (
      <span className="cd">
        <b>{arNum(c.days)}</b>
        <u>يوم</u>
      </span>
    )
  }

  return (
    <span className="cd soon">
      <b>
        {arPad2(c.hours)}:{arPad2(c.minutes)}
      </b>
      <u>ساعة · دقيقة</u>
    </span>
  )
}

/**
 * حالة الصفّ حين لا يكون قادماً — منقولة من `stateHTML`.
 * «جارٍ الآن» بنقطة نابضة، و«انتهى» أو «أُلغي» نصّاً هادئاً.
 */
export function StatusCell({ vm }: { vm: LectureVM }) {
  if (vm.status === 'live') {
    return (
      <span className="state live">
        <span className="dot" />
        جارٍ الآن
      </span>
    )
  }
  return <span className="state">{vm.statusLabel}</span>
}

/**
 * ما يظهر في خانة العدّاد: عدّاد للقادم، ووصف حالة لما سواه.
 * الحالة تأتي من `v_lectures` ولا تُشتقّ من الوقت هنا (القاعدة ٦.١).
 */
export function CountdownOrStatus({ vm }: { vm: LectureVM }) {
  return vm.status === 'upcoming' ? <Countdown startsAtMs={vm.startsAtMs} /> : <StatusCell vm={vm} />
}
