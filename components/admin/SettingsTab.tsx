'use client'

import { useEffect, useRef, useState } from 'react'
import { arNum } from '@/lib/datetime'

/**
 * تبويب الإعدادات — منقول من `vSet()` في النموذج المعتمد.
 *
 * ثلاث لوحات: شعار الجمعية · المقر الافتراضي · ثوابت لا تُعدَّل.
 *
 * ⚠️ الأثر الجانبي ٨.١ منصوصٌ عليه في نصّ الإرشاد تحت المقر — أثرٌ مقصود
 * لا خلل، والقسم ٨ ينهى عن معالجته بالتصميم.
 */

const MAX_BYTES = 2 * 1024 * 1024

export function SettingsTab({
  logoUrl,
  hqPlace,
  hqMapUrl,
  defaultDuration,
  onDone,
}: {
  logoUrl: string | null
  hqPlace: string
  hqMapUrl: string | null
  defaultDuration: number
  onDone: (message: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

  const [place, setPlace] = useState(hqPlace)
  const [mapUrl, setMapUrl] = useState(hqMapUrl ?? '')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // الإفلات **خارج** المنطقة يجعل المتصفح يفتح الملف ويغادر الصفحة
  useEffect(() => {
    const block = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  async function upload(file: File | undefined) {
    if (!file || uploading) return
    setLogoError(null)

    // فحصان في المتصفح — تجربة أفضل ورسالة فورية «قبل الرفع» (القسم ٧).
    // وهما مكرّران في الخادم، لأن فحص المتصفح لا يُعتدّ به حمايةً.
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setLogoError('الملف يجب أن يكون صورة PNG أو JPEG أو WebP.')
      return
    }
    if (file.type === 'image/svg+xml') {
      setLogoError('ملفات SVG غير مقبولة للشعار. ارفع PNG أو WebP أو JPEG.')
      return
    }
    if (file.size > MAX_BYTES) {
      setLogoError('حجم الملف يتجاوز ٢ ميجابايت.')
      return
    }

    // المعاينة داخل <img> حصراً — لا <object> ولا حقن نصّ في DOM
    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      const form = new FormData()
      form.append('logo', file)
      const res = await fetch('/api/admin/settings/logo', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setLogoError(data?.error ?? 'تعذّر رفع الشعار.')
        setPreview(null)
        return
      }
      setPreview(null)
      onDone('رُفع الشعار')
    } catch {
      setLogoError('تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.')
      setPreview(null)
    } finally {
      setUploading(false)
      // بدونه لا يُطلق اختيارُ الملف نفسه حدثاً ثانياً
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeLogo() {
    if (uploading) return
    setUploading(true)
    setLogoError(null)
    try {
      const res = await fetch('/api/admin/settings/logo', { method: 'DELETE' })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setLogoError(data?.error ?? 'تعذّر إزالة الشعار.')
        return
      }
      onDone('أُزيل الشعار')
    } catch {
      setLogoError('تعذّر الاتصال بالخادم.')
    } finally {
      setUploading(false)
    }
  }

  async function saveSettings() {
    if (savingSettings) return
    setSavingSettings(true)
    setSettingsError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hq_place: place.trim(), hq_map_url: mapUrl.trim() || null }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setSettingsError(data?.error ?? 'تعذّر حفظ الإعدادات.')
        return
      }
      onDone('حُفظت الإعدادات')
    } catch {
      setSettingsError('تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.')
    } finally {
      setSavingSettings(false)
    }
  }

  const shown = preview ?? logoUrl

  return (
    <>
      <div className="head">
        <div>
          <h2>الإعدادات</h2>
          <p>قيم تُكتب مرة وتسري على كل اللقاءات</p>
        </div>
      </div>

      {/* ───── شعار الجمعية ───── */}
      <div className="panel">
        <div className="ph2">شعار الجمعية</div>
        <div className="pb">
          {logoError ? (
            <p className="loginerr" role="alert">
              {logoError}
            </p>
          ) : null}

          <div
            className={over ? 'drop over' : 'drop'}
            onDragEnter={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault()
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              upload(e.dataTransfer.files[0])
            }}
          >
            <div className="dprev">
              {shown ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shown} alt="الشعار" />
              ) : (
                <span>لا شعار بعد</span>
              )}
            </div>

            <div className="dtxt">
              <b>اسحب ملف الشعار هنا أو اخترْه</b>
              <p className="hint">
                PNG أو WebP بخلفية شفافة · العرض المناسب ٣٠٠–٦٠٠ بكسل · حتى ٢ ميجابايت
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn g sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? 'جارٍ الرفع…' : 'اختيار ملف'}
                </button>
                {logoUrl ? (
                  <button type="button" className="btn d sm" disabled={uploading} onClick={removeLogo}>
                    إزالة
                  </button>
                ) : null}
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </div>

          <p className="hint" style={{ marginTop: 12 }}>
            يُرفع إلى مخزن المشروع ويظهر في الترويسة فوراً — بلا إعادة نشر.
          </p>
        </div>
      </div>

      {/* ───── المقر الافتراضي ───── */}
      <div className="panel">
        <div className="ph2">المقر الافتراضي</div>
        <div className="pb">
          {settingsError ? (
            <p className="loginerr" role="alert">
              {settingsError}
            </p>
          ) : null}

          <div className="grid2">
            <div className="f">
              <label htmlFor="cP">اسم المكان</label>
              <input id="cP" type="text" value={place} onChange={(e) => setPlace(e.target.value)} />
            </div>
            <div className="f">
              <label htmlFor="cM">رابط الموقع على الخرائط</label>
              <input
                id="cM"
                type="url"
                dir="ltr"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
              />
            </div>
          </div>

          {/* الأثر الجانبي ٨.١ — منصوصٌ عليه هنا كما في النموذج، ولا يُعالَج بالتصميم */}
          <p className="hint">
            يُعبَّأ تلقائياً في كل سلسلة حضورية — وتغييره هنا يسري على كل اللقاءات التي لم يُكتب لها
            مكان خاص.
          </p>

          <div className="f" style={{ marginTop: 16, maxWidth: 220 }}>
            <label htmlFor="cD">المدة الافتراضية للقاء (دقيقة)</label>
            <input id="cD" type="number" value={defaultDuration} disabled />
            <p className="hint">
              معطّل مؤقّتاً: لا عمود لهذه القيمة في المخطط، والافتراضي {arNum(defaultDuration)} مثبّت
              فيه. تفعيله يحتاج إذن صاحب المشروع.
            </p>
          </div>

          <div className="bar2">
            <button className="btn p" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
            </button>
          </div>
        </div>
      </div>

      {/* ───── ثوابت لا تُعدَّل ───── */}
      <div className="panel">
        <div className="ph2">ثوابت لا تُعدَّل</div>
        <div className="pb">
          <div className="grid2">
            <div className="f">
              <label>المنطقة الزمنية</label>
              <input type="text" value="توقيت السعودية (Asia/Riyadh)" disabled />
            </div>
            <div className="f">
              <label>تقويم العرض</label>
              <input type="text" value="هجري — أم القرى" disabled />
            </div>
          </div>
          <p className="hint">
            التواريخ تُدخَل وتُخزَّن ميلادياً وتُعرض للزائر هجرياً. كلمة مرور اللوحة تُغيَّر من
            إعدادات Vercel لا من هنا.
          </p>
        </div>
      </div>
    </>
  )
}
