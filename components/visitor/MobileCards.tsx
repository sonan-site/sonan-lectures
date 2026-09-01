'use client'

import type { LectureVM } from '@/lib/view-model'
import { CountdownOrStatus } from './Countdown'
import { EmptyState, type EmptyKind } from './EmptyState'

/**
 * بطاقات الجوال — منقولة من النموذج المعتمد.
 *
 * دون ٩٦٠ بكسل يختفي الجدول وتظهر هذه: بطاقة صفٍّ واحد فيها عنوان اللقاء
 * واسم الشيخ وزرّ «التفاصيل» والعدّاد. والنقر يفتح نافذة بكل الحقول.
 *
 * التبديل بينها وبين الجدول بـ`@media` في الورقة لا بقياس في JavaScript —
 * فالخادم لا يعرف عرض الشاشة، وأي قياس هناك يعني وميضاً وعدم تطابق ترطيب.
 */
export function MobileCards({
  rows,
  emptyKind: kind,
  onOpen,
}: {
  rows: LectureVM[]
  emptyKind: EmptyKind
  onOpen: (id: string) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="cards">
        <EmptyState kind={kind} />
      </div>
    )
  }

  return (
    <div className="cards">
      {rows.map((vm) => (
        <button
          key={vm.id}
          className={`mcard ${vm.rowClass}`.trimEnd()}
          onClick={() => onOpen(vm.id)}
        >
          <span className="mid">
            <b className="t">{vm.title}</b>
            <span className="sh">{vm.sheikhName}</span>
            <span className="det">التفاصيل</span>
          </span>
          <CountdownOrStatus vm={vm} />
        </button>
      ))}
    </div>
  )
}
