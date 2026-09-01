'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { arNum, arPad2, countdown } from '@/lib/datetime'
import type { LectureVM } from '@/lib/view-model'
import { useNow } from './NowProvider'
import { Destination, TypeChip } from './cells'
import { IcsButton } from './IcsButton'

/**
 * نافذة التفاصيل — منقولة من `detailHTML` و`<dialog id="dlg">` في النموذج.
 *
 * ⚠️ لا تُصيَّر سمة `open` أبداً. تمريرها كخاصية في React يضبط السمة ولا
 * يستدعي `showModal()`، فتُفتح النافذة داخل تدفّق الصفحة: بلا طبقة عليا،
 * وبلا `::backdrop`، وبلا إغلاق بـEsc، وتمرّ فوقها `.bar` اللاصقة
 * (`z-index:20`). الفتح والإغلاق يمرّان بالأسلوب الأصلي عبر `ref`.
 *
 * ويجب ربط `onClose`: الإغلاق بـEsc لا يمرّ بـReact، فتبقى حالة الفتح
 * صحيحة عندنا والنافذة مغلقة — ثم لا تُفتح ثانيةً أبداً.
 */

function LectureDetail({ vm }: { vm: LectureVM }) {
  const now = useNow()
  const c = countdown(vm.startsAtMs, now)

  return (
    <div className="item">
      <b
        style={{
          fontSize: 17,
          fontWeight: 800,
          display: 'block',
          textDecoration: vm.isCancelled ? 'line-through' : undefined,
        }}
      >
        {vm.title}
      </b>
      {vm.book ? (
        <div style={{ fontSize: 12, color: 'var(--warm)', fontWeight: 500, marginTop: 3 }}>
          {vm.book}
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {vm.seriesSlug ? (
          <div className="kv">
            <span>السلسلة</span>
            <b>
              <Link className="sheikh" href={`/s/${vm.seriesSlug}`}>
                {vm.title}
              </Link>
            </b>
          </div>
        ) : null}
        <div className="kv">
          <span>الترتيب</span>
          <b>{vm.ordAr}</b>
        </div>
        {/* نصّ عارٍ كما في النموذج: صفّ «الشيخ» فيه <b> بلا صنف ولا رابط.
            وصفّ «السلسلة» أعلاه رابط لأن النموذج يجعله زرّاً يفتح السلسلة. */}
        <div className="kv">
          <span>الشيخ</span>
          <b>{vm.sheikhName}</b>
        </div>
        <div className="kv">
          <span>التاريخ</span>
          <b>
            {vm.weekdayName} {vm.hijri}
          </b>
        </div>
        <div className="kv">
          <span>الوقت</span>
          <b>{vm.time}</b>
        </div>
        <div className="kv">
          <span>المدة</span>
          <b>{vm.durationAr} دقيقة</b>
        </div>
        <div className="kv">
          <span>النوع</span>
          <b>
            <TypeChip vm={vm} />
          </b>
        </div>
        <div className="kv">
          <span>الحالة</span>
          <b>{vm.statusLabel}</b>
        </div>
        {vm.status === 'upcoming' ? (
          <div className="kv">
            <span>يبقى</span>
            <b>
              {c.days >= 1
                ? `${arNum(c.days)} يوم`
                : `${arPad2(c.hours)} ساعة و${arPad2(c.minutes)} دقيقة`}
            </b>
          </div>
        ) : null}
      </div>

      {vm.isCancelled ? null : (
        <div className="acts">
          <Destination vm={vm} />
          {vm.status === 'upcoming' ? <IcsButton id={vm.id} /> : null}
        </div>
      )}
    </div>
  )
}

export function LectureDialog({
  title,
  items,
  onClose,
}: {
  /** عنوان الترويسة: «تفاصيل اللقاء» أو تاريخ اليوم في عرض التقويم */
  title: string | null
  items: LectureVM[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const open = title !== null

  useEffect(() => {
    const d = ref.current
    if (!d) return

    if (open) {
      // الحارس لازم: StrictMode يشغّل الأثر مرّتين في التطوير،
      // و`showModal()` على نافذة مفتوحة ترمي InvalidStateError
      if (!d.open) d.showModal()
    } else if (d.open) {
      d.close()
    }

    return () => {
      if (d.open) d.close()
    }
  }, [open])

  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-labelledby="dlg-title">
      <div className="dh">
        {/* الاسم المتاح للنافذة: بدونه يُعلن قارئ الشاشة «حوار» بلا عنوان،
            فلا يعرف الزائر أي يوم فُتح ولا أي لقاء */}
        <b id="dlg-title">{title ?? ''}</b>
        <button onClick={onClose} aria-label="إغلاق">
          ×
        </button>
      </div>
      <div className="db">
        {items.map((vm) => (
          <LectureDetail key={vm.id} vm={vm} />
        ))}
      </div>
    </dialog>
  )
}
