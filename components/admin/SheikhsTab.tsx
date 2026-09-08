'use client'

import { useState } from 'react'
import type { AdminSheikhVM } from '@/lib/admin-queries'
import { ConfirmDialog, callOrThrow } from './ConfirmDialog'
import { DeleteIcon, EyeIcon, EyeOffIcon } from './ActionIcons'

/**
 * تبويب المشايخ — منقول من `vShk()` في النموذج المعتمد.
 *
 * الاسم · رابط الصفحة · عدد السلاسل · مفتاح نشط/غير نشط · حذف القالب.
 *
 * **الحذف نقض صريح لنصّ القسم ٥ والقاعدة ٦.٦** — أُضيف بعد هجرة ٠٠٢
 * وموافقة صاحب المشروع الصريحة. لكنه يحفظ غرض القاعدة الأصلي أتمَّ ممّا
 * كانت تفعله: هذا الجدول صار **قائمة قوالب**، والاسم والرابط نُسخا لقطةً
 * داخل كل سلسلة عند إنشائها. فحذف القالب هنا لا يمسّ سلسلة ولا لقاءً ولا
 * حتى الرابط العام `/sheikh/<slug>` — تشهد له نافذة التأكيد بالعدد.
 *
 * ⚠️ **دون ٨٢٠px يتحوّل الجدول إلى بطاقات** (`.admin-cards`) — نفس أصناف
 * اللقاءات والسلاسل معمَّمة. الشارة الرقمية هنا `seriesCountAr`، ورقاقة
 * الحالة تقع في سطر الإجراءات بدل عمود مستقلّ — أقلّ حقولاً من التبويبين
 * الآخرين فتركيبها أبسط: لا سطر «meta» منفصل، رابط الصفحة وحده يكفي.
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
  const [toDelete, setToDelete] = useState<AdminSheikhVM | null>(null)

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

  /** أزرار الإجراءات — مصدر واحد، يُستعمل في الجدول والبطاقة معاً */
  function Actions({ s }: { s: AdminSheikhVM }) {
    return (
      <>
        <button
          className="btn g icon"
          disabled={busyId === s.id}
          title={s.isActive ? 'إخفاء' : 'تنشيط'}
          aria-label={s.isActive ? 'إخفاء' : 'تنشيط'}
          onClick={() => toggle(s)}
        >
          {s.isActive ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <button
          className="btn d icon"
          disabled={busyId === s.id}
          title="حذف"
          aria-label="حذف"
          onClick={() => setToDelete(s)}
        >
          <DeleteIcon />
        </button>
      </>
    )
  }

  return (
    <>
      <div className="head">
        <div>
          <h2>المشايخ</h2>
          <p>لكل شيخ صفحة برابط ثابت · هذه قائمة قوالب — حذف القالب لا يمسّ سلاسله</p>
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
        <div className="tblwrap admin-desktop-table">
          <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>رابط صفحته</th>
                  <th>السلاسل</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
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
                      <div className="actions">
                        <Actions s={s} />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* البطاقات — دون ٨٢٠px */}
        <div className="admin-cards">
          {sheikhs.map((s) => (
            <div key={s.id} className="admin-card">
              <div className="row1">
                <div className="titles">
                  <span className="tt">{s.name}</span>
                </div>
                <span className="badge-num">{s.seriesCountAr}</span>
              </div>

              <p className="link-line" dir="ltr">
                /sheikh/{s.slug}
              </p>

              <div className="foot-row">
                <span className={s.isActive ? 'chip act' : 'chip ina'}>
                  {s.isActive ? 'نشط' : 'غير نشط'}
                </span>
                <div className="actions">
                  <Actions s={s} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        title="حذف قالب الشيخ"
        confirmLabel="حذف القالب"
        danger
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          const data = await callOrThrow(
            `/api/admin/sheikhs/${toDelete.id}?expect=${toDelete.seriesCount}&expectLectures=${toDelete.overriddenLectureCount}`,
            { method: 'DELETE' }
          )
          setToDelete(null)
          onDone(data.message ?? 'حُذف القالب')
        }}
        body={
          toDelete ? (
            <>
              حذف قالب <b>«{toDelete.name}»</b> من قائمة المشايخ نهائياً.
              {toDelete.seriesCount > 0 || toDelete.overriddenLectureCount > 0 ? (
                <>
                  {' '}
                  {toDelete.seriesCount > 0 ? (
                    <>
                      له <b>{toDelete.seriesCountAr}</b> سلسلة —{' '}
                    </>
                  ) : null}
                  {toDelete.overriddenLectureCount > 0 ? (
                    <>
                      و<b>{toDelete.overriddenLectureCountAr}</b> لقاءً يتجاوز عليه مباشرة —{' '}
                    </>
                  ) : null}
                  تبقى كاملةً باسمه ورابطه، ويبقى رابطه العام{' '}
                  <code dir="ltr">/sheikh/{toDelete.slug}</code> عاملاً.
                </>
              ) : (
                <> لا سلاسل ولا لقاءات متجاوِزة له، فلا يتأثّر شيء آخر.</>
              )}
              <br />
              <br />
              هذا يزيله من قائمة اختيار الشيخ عند إنشاء سلسلة جديدة فقط.
            </>
          ) : null
        }
      />
    </>
  )
}
