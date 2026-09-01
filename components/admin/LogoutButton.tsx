'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * زرّ الخروج — منقول من `<button class="out">خروج</button>` في النموذج.
 *
 * يرسل `POST` لا `GET`: الطلبات الآمنة لا يجوز أن تُحدث أثراً، ولئلّا
 * يُخرِج المشرفَ استباقُ رابطٍ أو جلبُ صورة.
 */
export function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <button
      className="out"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/admin/logout', { method: 'POST' })
        } finally {
          router.replace('/admin/login')
          router.refresh()
        }
      }}
    >
      {busy ? 'جارٍ الخروج…' : 'خروج'}
    </button>
  )
}
