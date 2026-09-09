'use client'

import { useState } from 'react'
import type { AdminSheikhVM } from '@/lib/admin-queries'

/**
 * نافذة «تعديل شيخ» — بنمط `NewSheikhForm.tsx`، زائد مفتاح تطبيق رجعي.
 *
 * الاسم والرابط لقطة تُنسخ داخل كل سلسلة ولقاء عند إنشائهما (النموذج
 * القالبي)، فتعديلهما هنا وحده **لا يغيّر شيئاً ظاهراً للزائر** ما لم
 * يُفعَّل المفتاح صراحة — عندها يُطبَّق الاسم والرابط الجديدان على كل
 * سلاسله ولقاءاته المتجاوِزة القائمة أيضاً، فلا يبقى صفّ يشير للرابط
 * القديم. ولا اقتراح تلقائي للرابط من الاسم هنا كما في نافذة الإنشاء —
 * الرابط موجود أصلاً ومقصود، فتغيير الاسم لا يجوز أن يُبدّله ضمناً.
 */
export function EditSheikhForm({
  sheikh,
  onSaved,
  onCancel,
}: {
  sheikh: AdminSheikhVM
  onSaved: (message: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(sheikh.name)
  const [slug, setSlug] = useState(sheikh.slug)
  const [applyExisting, setApplyExisting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const affectsExisting = sheikh.seriesCount > 0 || sheikh.overriddenLectureCount > 0

  async function save() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sheikhs/${sheikh.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          apply_existing: applyExisting,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null
      if (!res.ok) {
        setError(data?.error ?? 'تعذّر حفظ التعديل.')
        return
      }
      onSaved(data?.message ?? 'حُفظ التعديل')
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
        <label htmlFor="eSN">الاسم كما يظهر للزائر</label>
        <input
          id="eSN"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="eSG">رابط صفحته</label>
        <input
          id="eSG"
          type="text"
          dir="ltr"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <p className="hint">حروف لاتينية صغيرة وشُرَط فقط</p>
      </div>

      {affectsExisting ? (
        <>
          <label className="sw" style={{ marginTop: 18 }}>
            <input
              type="checkbox"
              checked={applyExisting}
              onChange={(e) => setApplyExisting(e.target.checked)}
            />
            تطبيق هذا على سلاسله ولقاءاته الحالية أيضاً
          </label>
          <p className="hint">
            {applyExisting
              ? `سيُطبَّق هذا على ${sheikh.seriesCountAr} سلسلة و${sheikh.overriddenLectureCountAr} لقاءً متجاوِزاً.`
              : 'سلاسله ولقاءاته الحالية تبقى بالاسم والرابط القديمين.'}
          </p>
        </>
      ) : (
        <p className="hint" style={{ marginTop: 14 }}>
          لا سلاسل ولا لقاءات له بعد، فلا شيء آخر يتأثّر بهذا التعديل.
        </p>
      )}

      <div className="bar2">
        <button className="btn g" onClick={onCancel} disabled={busy}>
          إلغاء
        </button>
        <button
          className="btn p"
          onClick={save}
          disabled={busy || name.trim() === '' || slug.trim() === ''}
        >
          {busy ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
      </div>
    </>
  )
}
