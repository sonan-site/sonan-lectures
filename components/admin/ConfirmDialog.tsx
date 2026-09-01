'use client'

import { useState } from 'react'
import { AdminDialog } from './AdminDialog'

/**
 * نافذة تأكيد موحّدة لكل فعل مُهلِك أو واسع الأثر — حذف، أو حذف نهائيّ.
 *
 * تذكر التبعات بالأرقام قبل التنفيذ (`body`)، وتحمل زرّاً بلون الخطر
 * للأفعال التي لا رجعة فيها. ولا سجلّ بعد الحذف (القسم ١٠)، فهذه النافذة
 * هي فرصة المراجعة الوحيدة.
 *
 * `run` ينفّذ الطلب ويعيد رسالة نجاح أو يرمي رسالة الخطأ — والنافذة تتكفّل
 * بحالة الانتظار وعرض الفشل، فلا يكرّرها كل مستدعٍ.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  open,
  onClose,
  onConfirm,
}: {
  title: string
  body: React.ReactNode
  confirmLabel: string
  danger?: boolean
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تنفيذ الطلب.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminDialog
      title={title}
      open={open}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--petrol)' }}>{body}</div>

      {error ? (
        <p className="loginerr" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}

      <div className="bar2" style={{ marginTop: 18 }}>
        <button className="btn g" onClick={onClose} disabled={busy}>
          إلغاء
        </button>
        <button className={danger ? 'btn d' : 'btn p'} onClick={go} disabled={busy}>
          {busy ? 'جارٍ التنفيذ…' : confirmLabel}
        </button>
      </div>
    </AdminDialog>
  )
}

/** يترجم فشل fetch إلى رمي — ليقع في `catch` عند `ConfirmDialog` */
export async function callOrThrow(
  input: RequestInfo,
  init?: RequestInit
): Promise<{ message?: string }> {
  const res = await fetch(input, init)
  const data = (await res.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null
  if (!res.ok) throw new Error(data?.error ?? 'تعذّر تنفيذ الطلب.')
  return data ?? {}
}
