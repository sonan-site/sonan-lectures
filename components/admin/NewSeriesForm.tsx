'use client'

import { useMemo, useState } from 'react'
import { arNum, dayKey, hijriDate, timeOfDay, weekday } from '@/lib/datetime'
import { slugify, uniqueSlug } from '@/lib/slug'
import type { LectureType } from '@/lib/types'

/**
 * نموذج «سلسلة جديدة» — منقول من `newSer()` في النموذج المعتمد.
 *
 * وتحته معاينة حيّة للتواريخ المولّدة بالهجري، بجانب كل موعد زرّ حذف،
 * **والترقيم يُعاد بعد الحذف**: يُرقَّم المعروض بترتيبه بين الباقين لا
 * بموضعه الأصلي، ولا تُرسَل المحذوفات إلى الخادم أصلاً — فحذف موعد من
 * أربعة يُنتج ثلاثة صفوف ترتيبها ١ و٢ و٣ (معيار القبول ١١).
 */

const TYPES: { value: LectureType; label: string }[] = [
  { value: 'onsite', label: 'حضوري' },
  { value: 'remote', label: 'عن بُعد' },
  { value: 'hybrid', label: 'حضوري وعن بُعد' },
]

const REPEATS = [
  { value: 7, label: 'كل أسبوع' },
  { value: 14, label: 'كل أسبوعين' },
  { value: 1, label: 'يومياً' },
]

const DAY_MS = 86_400_000

export function NewSeriesForm({
  sheikhs,
  takenSlugs,
  hqPlace,
  hqMapUrl,
  onCreated,
  onCancel,
}: {
  sheikhs: { id: string; name: string }[]
  takenSlugs: string[]
  hqPlace: string
  hqMapUrl: string | null
  onCreated: (message: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [book, setBook] = useState('')
  const [sheikhId, setSheikhId] = useState(sheikhs[0]?.id ?? '')
  const [type, setType] = useState<LectureType>('onsite')
  const [place, setPlace] = useState(hqPlace)
  const [joinUrl, setJoinUrl] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('20:00')
  const [duration, setDuration] = useState('90')
  const [repeat, setRepeat] = useState(7)
  const [count, setCount] = useState('1')
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /**
   * توليد المواعيد.
   *
   * ⚠️ الخطو بالمللي ثانية لا بـ`setDate`: تلك تخطو «يوماً محلّياً» بتوقيت
   * جهاز المشرف، وهو ٢٣ أو ٢٥ ساعة عند انتقال التوقيت الصيفي — فينزلق
   * الموعد يوماً كاملاً عند من يعمل من خارج السعودية. والرياض بلا توقيت
   * صيفي، فخطوة ٢٤ ساعة مطلقة تحفظ يوم الأسبوع وساعة الحائط معاً.
   */
  const generated = useMemo(() => {
    if (!date || !time) return []
    const n = Math.max(1, Math.min(60, Number(count) || 1))
    const step = n > 1 ? repeat : 0

    const anchor = new Date(`${date}T12:00:00+03:00`)
    if (Number.isNaN(anchor.getTime())) return []

    const out: Date[] = []
    for (let i = 0; i < n; i++) {
      const day = new Date(anchor.getTime() + i * step * DAY_MS)
      const stamped = new Date(`${dayKey(day)}T${time}:00+03:00`)
      if (!Number.isNaN(stamped.getTime())) out.push(stamped)
    }
    return out
  }, [date, time, repeat, count])

  const kept = generated.filter((_, i) => !removed.has(i))

  const suggestedSlug = slugTouched ? slug : uniqueSlug(slugify(title), takenSlugs)

  async function create() {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/series', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: suggestedSlug,
          book: book.trim() || null,
          sheikh_id: sheikhId,
          type,
          place: type === 'remote' ? null : place.trim() || null,
          map_url: type === 'remote' ? null : hqMapUrl,
          join_url: type === 'onsite' ? null : joinUrl.trim() || null,
          duration_min: Number(duration) || 90,
          starts: kept.map((d) => d.toISOString()),
        }),
      })

      const data = (await res.json().catch(() => null)) as
        | { error?: string; count?: number }
        | null

      if (!res.ok) {
        setError(data?.error ?? 'تعذّر إنشاء السلسلة.')
        return
      }
      onCreated(`أُنشئت السلسلة بـ${arNum(data?.count ?? kept.length)} لقاء`)
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
        <label htmlFor="nT">عنوان اللقاء</label>
        <input
          id="nT"
          type="text"
          placeholder="شرح بلوغ المرام"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="nB">
          اسم الكتاب <em>(اختياري — يظهر تحت العنوان)</em>
        </label>
        <input
          id="nB"
          type="text"
          placeholder="بلوغ المرام من أدلة الأحكام"
          value={book}
          onChange={(e) => setBook(e.target.value)}
        />
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="nG">رابط صفحة السلسلة</label>
        <input
          id="nG"
          type="text"
          dir="ltr"
          placeholder="يُقترح تلقائياً من العنوان"
          value={suggestedSlug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
        />
        <p className="hint">
          حروف لاتينية صغيرة وشُرَط فقط · انشره عند إعلان الشرح · لا يُغيَّر بعد نشره
        </p>
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="nS">الشيخ</label>
        <select id="nS" value={sheikhId} onChange={(e) => setSheikhId(e.target.value)}>
          {sheikhs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label>النوع</label>
        <div className="radios">
          {TYPES.map((t) => (
            <label key={t.value}>
              <input
                type="radio"
                name="nty"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {type !== 'remote' ? (
        <div className="f" style={{ marginTop: 14 }}>
          <label htmlFor="nPl">المكان</label>
          <input id="nPl" type="text" value={place} onChange={(e) => setPlace(e.target.value)} />
          <p className="hint">مُعبّأ من الإعدادات — غيّره فقط إذا خرج اللقاء عن المقر</p>
        </div>
      ) : null}

      {type !== 'onsite' ? (
        <div className="f" style={{ marginTop: 14 }}>
          <label htmlFor="nLk">رابط الدخول</label>
          <input
            id="nLk"
            type="url"
            dir="ltr"
            placeholder="https://…"
            value={joinUrl}
            onChange={(e) => setJoinUrl(e.target.value)}
          />
        </div>
      ) : null}

      <div className="grid3" style={{ marginTop: 14 }}>
        <div className="f">
          <label htmlFor="nD">تاريخ أول لقاء</label>
          <input id="nD" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="nTm">الوقت</label>
          <input id="nTm" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="nDu">المدة (دقيقة)</label>
          <input
            id="nDu"
            type="number"
            min={5}
            max={600}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="f">
          <label htmlFor="nR">التكرار</label>
          <select id="nR" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
            {REPEATS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="f">
          <label htmlFor="nC">عدد اللقاءات</label>
          <input
            id="nC"
            type="number"
            min={1}
            max={60}
            value={count}
            onChange={(e) => {
              setCount(e.target.value)
              setRemoved(new Set())
            }}
          />
          <p className="hint">اتركه ١ للقاء المنفرد</p>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label
          style={{
            display: 'block',
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--brown)',
            marginBottom: 7,
          }}
        >
          التواريخ المولّدة{' '}
          <em style={{ fontStyle: 'normal', color: '#B8AFA5' }}>
            — احذف أي موعد لا يناسب (عيد، سفر…)
          </em>
        </label>

        <div className="prev">
          {generated.length === 0 ? (
            <div className="empty" style={{ padding: 22 }}>
              اختر تاريخ أول لقاء لتظهر التواريخ
            </div>
          ) : (
            generated.map((d, i) => {
              const gone = removed.has(i)
              // الترقيم بين الباقين لا بالموضع الأصلي — فيُعاد بعد كل حذف
              const rank = gone ? null : generated.filter((_, j) => j < i && !removed.has(j)).length + 1
              return (
                <div className={gone ? 'prow gone' : 'prow'} key={d.toISOString() + i}>
                  <b>{rank === null ? '—' : arNum(rank)}</b>
                  <span>
                    {weekday(d)} {hijriDate(d)} <u>· {timeOfDay(d)}</u>
                  </span>
                  <button
                    type="button"
                    title={gone ? 'استرجاع' : 'حذف'}
                    aria-label={gone ? 'استرجاع الموعد' : 'حذف الموعد'}
                    onClick={() => {
                      const next = new Set(removed)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      setRemoved(next)
                    }}
                  >
                    {gone ? '↺' : '×'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="bar2">
        <button className="btn g" onClick={onCancel} disabled={busy}>
          إلغاء
        </button>
        <button
          className="btn p"
          onClick={create}
          disabled={busy || kept.length === 0 || title.trim() === '' || !sheikhId}
        >
          {busy ? 'جارٍ الإنشاء…' : 'إنشاء السلسلة'}
        </button>
      </div>
    </>
  )
}
