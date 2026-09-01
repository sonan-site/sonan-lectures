'use client'

import { useState } from 'react'
import { slugify, uniqueSlug } from '@/lib/slug'

/**
 * نافذة «شيخ جديد» — منقولة من `newShk()` في النموذج المعتمد.
 *
 * الرابط يُقترح من الاسم ويُعدَّل، ولا يُغيَّر بعد إرساله للشيخ — فهو عنوان
 * صفحته العامة التي يقرأ منها جدوله.
 */
export function NewSheikhForm({
  takenSlugs,
  onCreated,
  onCancel,
}: {
  takenSlugs: string[]
  onCreated: (message: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const value = slugTouched ? slug : uniqueSlug(slugify(name), takenSlugs)

  async function create() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/sheikhs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: value }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(data?.error ?? 'تعذّر إضافة الشيخ.')
        return
      }
      onCreated('أُضيف الشيخ')
    } catch {
      setError('تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error ? (
        <p className="loginerr" role="alert">
          {error}
        </p>
      ) : null}

      <div className="f">
        <label htmlFor="sN">الاسم كما يظهر للزائر</label>
        <input
          id="sN"
          type="text"
          placeholder="الشيخ عبدالله المحمد"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="sG">رابط صفحته</label>
        <input
          id="sG"
          type="text"
          dir="ltr"
          placeholder="abdullah-almohammed"
          value={value}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
        />
        <p className="hint">حروف لاتينية صغيرة وشُرَط فقط · لا يُغيَّر بعد إرساله للشيخ</p>
      </div>

      <div className="bar2">
        <button className="btn g" onClick={onCancel} disabled={busy}>
          إلغاء
        </button>
        <button
          className="btn p"
          onClick={create}
          disabled={busy || name.trim() === '' || value === ''}
        >
          {busy ? 'جارٍ الإضافة…' : 'إضافة'}
        </button>
      </div>
    </>
  )
}
