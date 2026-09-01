'use client'

import { useState } from 'react'
import type { AdminSheikhVM } from '@/lib/admin-queries'

/**
 * تبويب المشايخ — منقول من `vShk()` في النموذج المعتمد.
 *
 * الاسم · رابط الصفحة · عدد السلاسل · مفتاح نشط/غير نشط.
 *
 * **لا زرّ حذف إطلاقاً** (القسم ٥ والقاعدة ٦.٦): الشيخ يُخفى ولا يُحذف،
 * والقيد `on delete restrict` في المخطط يمنع الحذف أصلاً. والإخفاء يُخرجه
 * من قائمة اختيار السلسلة ومن تصفية الزائر، وتبقى لقاءاته في «السابقة».
 */
export function SheikhsTab({
  sheikhs,
  onDone,
  onNewSheikh,
}: {
  sheikhs: AdminSheikhVM[]
  onDone: (message: string) => void
  onNewSheikh: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(s: AdminSheikhVM) {
    if (busyId) return
    setBusyId(s.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sheikhs/${s.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: !s.isActive }),
      })
      const data = (await res.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null
      if (!res.ok) {
        setError(data?.error ?? 'تعذّر حفظ التغيير.')
        return
      }
      onDone(data?.message ?? 'حُفظ التغيير')
    } catch {
      setError('تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <h2>المشايخ</h2>
          <p>لكل شيخ صفحة برابط ثابت · الشيخ لا يُحذف بل يُخفى</p>
        </div>
        <button className="btn p" onClick={onNewSheikh}>
          ＋ شيخ جديد
        </button>
      </div>

      {error ? (
        <p className="loginerr" role="alert">
          {error}
        </p>
      ) : null}

      <div className="panel">
        {/* النموذج يصيّر الجدول دائماً بلا فرع «فارغ» — بخلاف تبويب السلاسل */}
        <div className="tblwrap">
          <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>رابط صفحته</th>
                  <th>السلاسل</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sheikhs.map((s) => (
                  <tr key={s.id}>
                    <td className="tt">{s.name}</td>
                    <td
                      dir="ltr"
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: 12.5,
                        color: 'var(--brown)',
                      }}
                    >
                      /sheikh/{s.slug}
                    </td>
                    <td style={{ fontWeight: 800 }}>{s.seriesCountAr}</td>
                    <td>
                      <span className={s.isActive ? 'chip act' : 'chip ina'}>
                        {s.isActive ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn g sm"
                        disabled={busyId === s.id}
                        onClick={() => toggle(s)}
                      >
                        {busyId === s.id ? '…' : s.isActive ? 'إخفاء' : 'تنشيط'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
