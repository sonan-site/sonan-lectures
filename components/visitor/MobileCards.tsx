'use client'

import type { LectureVM } from '@/lib/view-model'
import { CountdownOrStatus } from './Countdown'
import { EmptyState, type EmptyKind } from './EmptyState'

/**
 * بطاقات الجوال — إعادة تصميم مصرَّح بها (انحراف مقصود عن النموذج
 * المعتمد، `DECISIONS.md` ٢٠٢٦-٠٩-٠٨) تُبرز مقدار اللقاء حين يوجد.
 *
 * العمود الأيمن (`.mid`) ثلاثة أسطر مرشَّحة — عنوان خافت اختياري، سطر
 * بارز (المقدار أو العنوان مُرقًّى إن غاب المقدار)، والشيخ. والعمود
 * الأيسر (`.side`) الحالة/العدّاد وشارة "التفاصيل" تحته مباشرة.
 *
 * `showSeriesColumns`/`showSheikhLine` يُخفيان العنوان/الشيخ على صفحتَي
 * السلسلة والشيخ (كلٌّ يحمل هويّته في رأس صفحته، فتكرارها هنا زائد) —
 * نفس دلالة `showSeriesColumns` المستعملة في `LectureTable` حرفياً.
 *
 * دون ٩٦٠ بكسل يختفي الجدول وتظهر هذه، بـ`@media` في الورقة لا بقياس في
 * JavaScript — فالخادم لا يعرف عرض الشاشة، وأي قياس هناك يعني وميضاً
 * وعدم تطابق ترطيب.
 */
export function MobileCards({
  rows,
  emptyKind: kind,
  onOpen,
  showSeriesColumns = true,
  showSheikhLine = true,
}: {
  rows: LectureVM[]
  emptyKind: EmptyKind
  onOpen: (id: string) => void
  /** يخفي العنوان الخافت — وفرصة إبراز اللقب مكانه — على صفحة السلسلة */
  showSeriesColumns?: boolean
  /** يخفي سطر الشيخ على صفحته هو */
  showSheikhLine?: boolean
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
      {rows.map((vm) => {
        const scopeFrom = vm.scopeFrom?.trim() || null
        // البارز: المقدار إن وُجد، وإلا العنوان مُرقّى — إلا في صفحة
        // السلسلة حيث العنوان ممنوع مطلقاً (الرأس يحمله)
        const prom = scopeFrom ?? (showSeriesColumns ? vm.title : null)
        // الخافت: العنوان يظهر سطراً مستقلاً فقط حين البارز هو المقدار فعلاً
        const dimTitle = scopeFrom && showSeriesColumns ? vm.title : null

        return (
          <button
            key={vm.id}
            className={`mcard ${vm.rowClass}`.trimEnd()}
            onClick={() => onOpen(vm.id)}
          >
            <span className="mid">
              {dimTitle ? <span className="ttl">{dimTitle}</span> : null}
              {prom ? <span className="prom">{prom}</span> : null}
              {showSheikhLine ? <span className="sh">{vm.sheikhName}</span> : null}
            </span>
            <span className="side">
              {vm.isCancelled ? (
                <span className="state">{vm.cancelledChip}</span>
              ) : (
                <CountdownOrStatus vm={vm} />
              )}
              {vm.isCancelled ? null : <span className="det">التفاصيل</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
