'use client'

import { useEffect, useRef } from 'react'

/**
 * نافذة اللوحة — منقولة من `<dialog id="dlg">` في `prototype/admin.html`.
 *
 * ⚠️ لا تُصيَّر سمة `open`: تمريرها في React يضبط السمة ولا يستدعي
 * `showModal()`، فتُفتح النافذة داخل تدفّق الصفحة بلا طبقة عليا ولا خلفية
 * معتمة ولا إغلاق بـEsc. الفتح والإغلاق بالأسلوب الأصلي عبر `ref`.
 *
 * و`onClose` مربوط: الإغلاق بـEsc لا يمرّ بـReact، فلولاه لبقيت حالة الفتح
 * صحيحة عندنا والنافذة مغلقة، ثم لا تُفتح ثانيةً أبداً.
 */
export function AdminDialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      if (!d.open) d.showModal()
    } else if (d.open) {
      d.close()
    }
    return () => {
      if (d.open) d.close()
    }
  }, [open])

  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-labelledby="admin-dlg-title">
      <div className="dh">
        <b id="admin-dlg-title">{title}</b>
        <button onClick={onClose} aria-label="إغلاق">
          ×
        </button>
      </div>
      <div className="db">{open ? children : null}</div>
    </dialog>
  )
}
