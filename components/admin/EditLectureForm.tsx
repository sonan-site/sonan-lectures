'use client'

import { useState } from 'react'
import { hijriDate, timeOfDay, weekday, arNum } from '@/lib/datetime'
import type { AdminLectureVM } from '@/lib/admin-queries'
import type { LectureType } from '@/lib/types'

/**
 * نافذة تعديل لقاء مفرد — منقولة من `editLec()` في النموذج المعتمد.
 *
 * المبدأ الحاكم: **الحقل الفارغ يرث السلسلة ولا يمسحها.** لذلك تظهر القيمة
 * الموروثة نصّاً إرشادياً داخل الحقل (`placeholder`) لا قيمةً فيه — فلو
 * كُتبت قيمةً لصارت تجاوزاً في اللحظة التي يحفظ فيها المشرف بلا أن يقصد.
 *
 * ولا يُحسب هنا شيء يخصّ القاعدة ٦.٨: الخادم هو من يفحص النوع والرابط
 * **الفعّالين بعد الوراثة** ويرفض. الواجهة تعرض رسالته ولا تجتهد دونها.
 */

const TYPES: { value: LectureType; label: string }[] = [
  { value: 'onsite', label: 'حضوري' },
  { value: 'remote', label: 'عن بُعد' },
  { value: 'hybrid', label: 'حضوري وعن بُعد' },
]

export function EditLectureForm({
  vm,
  onSaved,
  onCancel,
}: {
  vm: AdminLectureVM
  onSaved: (message: string) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(vm.dateInput)
  const [time, setTime] = useState(vm.timeInput)
  const [duration, setDuration] = useState(vm.ovDuration === null ? '' : String(vm.ovDuration))
  const [type, setType] = useState<string>(vm.ovType ?? '')
  const [place, setPlace] = useState(vm.ovPlace ?? '')
  const [joinUrl, setJoinUrl] = useState(vm.ovJoinUrl ?? '')
  const [cancelled, setCancelled] = useState(vm.isCancelled)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // معاينة الموعد بالهجري تحت الحقلين — تتحدّث مع كل تغيير كما في النموذج
  let preview = ''
  if (date && time) {
    const d = new Date(`${date}T${time}:00+03:00`)
    if (!Number.isNaN(d.getTime())) {
      preview = `${weekday(d)} ${hijriDate(d)} — ${timeOfDay(d)}`
    }
  }

  async function save() {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/lectures/${vm.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date,
          time,
          duration_min: duration.trim() === '' ? null : Number(duration),
          type: type === '' ? null : type,
          place: place.trim() === '' ? null : place.trim(),
          join_url: joinUrl.trim() === '' ? null : joinUrl.trim(),
          is_cancelled: cancelled,
        }),
      })

      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(data?.error ?? 'تعذّر حفظ التعديل.')
        return
      }
      onSaved('حُفظ التعديل')
    } catch {
      setError('تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="inh">
        القيم الفارغة ترث السلسلة: النوع «{vm.inhTypeLabel}» · المدة {arNum(vm.inhDuration)} دقيقة ·{' '}
        {vm.inhPlace}
      </div>

      {error ? (
        <p className="loginerr" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid2">
        <div className="f">
          <label htmlFor="eD">
            التاريخ <em>(ميلادي — يُعرض هجرياً)</em>
          </label>
          <input id="eD" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="eT">الوقت</label>
          <input id="eT" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <p className="hint">{preview}</p>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="eDur">
          المدة بالدقائق <em>(اتركه فارغاً ليرث {arNum(vm.inhDuration)})</em>
        </label>
        <input
          id="eDur"
          type="number"
          min={5}
          max={600}
          value={duration}
          placeholder={String(vm.inhDuration)}
          onChange={(e) => setDuration(e.target.value)}
        />
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label>النوع</label>
        <div className="radios">
          <label>
            <input
              type="radio"
              name="eTy"
              value=""
              checked={type === ''}
              onChange={() => setType('')}
            />
            كما السلسلة
          </label>
          {TYPES.map((t) => (
            <label key={t.value}>
              <input
                type="radio"
                name="eTy"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="ePl">
          المكان <em>(فارغ ⇐ {vm.inhPlace})</em>
        </label>
        <input
          id="ePl"
          type="text"
          value={place}
          placeholder={vm.inhPlace}
          onChange={(e) => setPlace(e.target.value)}
        />
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="eLk">
          رابط الدخول <em>(فارغ ⇐ رابط السلسلة)</em>
        </label>
        <input
          id="eLk"
          type="url"
          dir="ltr"
          value={joinUrl}
          placeholder={vm.inhJoinUrl ?? 'لا يوجد'}
          onChange={(e) => setJoinUrl(e.target.value)}
        />
      </div>

      <label className="sw warn" style={{ marginTop: 18 }}>
        <input
          type="checkbox"
          checked={cancelled}
          onChange={(e) => setCancelled(e.target.checked)}
        />
        إلغاء هذا اللقاء
        <span style={{ fontWeight: 600, color: 'var(--warm)', fontSize: 12 }}>
          — يبقى ظاهراً للزائر مشطوباً
        </span>
      </label>

      <div className="bar2">
        <button className="btn g" onClick={onCancel} disabled={busy}>
          إلغاء
        </button>
        <button className="btn p" onClick={save} disabled={busy}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
      </div>
    </>
  )
}
