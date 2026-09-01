'use client'

import { useEffect, useState } from 'react'

/**
 * شريط الإشعار — منقول من `toast()` في `prototype/admin.html`.
 * يظهر ٢١٠٠ مللي ثانية ثم يتلاشى، كما في النموذج.
 *
 * `role="status"` لا `alert`: إشعار نجاحٍ لا يقاطع قارئ الشاشة عمّا هو فيه.
 */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!message) return
    setShown(true)
    const hide = setTimeout(() => setShown(false), 2100)
    const clear = setTimeout(onDone, 2400)
    return () => {
      clearTimeout(hide)
      clearTimeout(clear)
    }
  }, [message, onDone])

  return (
    <div className={shown ? 'toast on' : 'toast'} role="status" aria-live="polite">
      {message ?? ''}
    </div>
  )
}
