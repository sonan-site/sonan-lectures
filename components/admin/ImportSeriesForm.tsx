'use client'

import { useRef, useState } from 'react'
import { arNum } from '@/lib/datetime'

interface RowIssue {
  row: number
  message: string
}

interface ImportResult {
  ok?: boolean
  created?: { slug: string; title: string; count: number }[]
  failed?: { slug: string; message: string }[]
  totalSeries?: number
  totalLectures?: number
  error?: string
  issues?: RowIssue[]
}

/**
 * نافذة «استيراد من إكسل» — تنزيل القالب، رفع ملف مُعبّأ، وعرض النتيجة.
 *
 * لا تحديث ولا دمج: كل صفّ ينشئ سلسلة **جديدة**، والملف يُرفض كاملاً إن
 * طابق رابطٌ فيه سلسلة موجودة (قرار صاحب المشروع). فتحقّق الخادم يعيد إمّا
 * قائمة أخطاء كاملة (٤٢٢) — لا أول خطأ فقط، ليُصلَح كل شيء في تمريرة
 * واحدة — أو ملخّص إنشاء ناجح.
 */
export function ImportSeriesForm({
  onCreated,
  onCancel,
}: {
  onCreated: (message: string) => void
  onCancel: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  function downloadTemplate() {
    // نقرة رابط مؤقّتة لا Blob — نفس نمط IcsButton.tsx، ليعمل على iOS Safari
    const a = document.createElement('a')
    a.href = '/api/admin/series/import-template'
    a.download = ''
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file || busy) return
    setBusy(true)
    setConnectionError(null)
    setResult(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/series/import', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as ImportResult | null
      setResult(data)
      if (res.ok && data?.created?.length) {
        onCreated(
          `أُنشئت ${arNum(data.created.length)} سلسلة بـ${arNum(data.totalLectures ?? 0)} لقاء`
        )
      }
    } catch {
      setConnectionError('تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.')
    } finally {
      setBusy(false)
    }
  }

  const issues = result?.issues ?? []
  const created = result?.created ?? []
  const failed = result?.failed ?? []

  return (
    <>
      <div className="inh">
        كل صفّ في الملف يمثّل لقاءً واحداً، وصفوف السلسلة نفسها تتكرّر فيها
        بقية الأعمدة حرفياً. الاستيراد لسلاسل <b>جديدة</b> فقط — رابطٌ
        يطابق سلسلة موجودة يرفض الملف كاملاً.
      </div>

      <div className="bar2" style={{ justifyContent: 'flex-start', paddingTop: 0, marginTop: 0, borderTop: 0 }}>
        <button type="button" className="btn g" onClick={downloadTemplate}>
          ⬇ تنزيل القالب
        </button>
      </div>

      <div className="f" style={{ marginTop: 14 }}>
        <label htmlFor="impFile">الملف المُعبَّأ</label>
        <input
          id="impFile"
          type="file"
          accept=".xlsx"
          ref={fileRef}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <p className="hint">صيغة .xlsx فقط · حتى ٤ ميجابايت</p>
      </div>

      {connectionError ? (
        <p className="loginerr" role="alert">
          {connectionError}
        </p>
      ) : null}

      {result?.error ? (
        <>
          <p className="loginerr" role="alert" style={{ marginTop: 14 }}>
            {result.error}
          </p>
          {issues.length > 0 ? (
            <div className="prev" style={{ marginTop: 10 }}>
              {issues.map((iss, i) => (
                <div className="prow" key={i}>
                  <b>{arNum(iss.row)}</b>
                  <span>{iss.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {created.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <p className="hint" style={{ color: 'var(--ok)', fontWeight: 700, marginBottom: 6 }}>
            أُنشئت {arNum(created.length)} سلسلة بـ{arNum(result?.totalLectures ?? 0)} لقاء
          </p>
          <div className="prev">
            {created.map((c) => (
              <div className="prow" key={c.slug}>
                <b>{arNum(c.count)}</b>
                <span>{c.title}</span>
                <u>/s/{c.slug}</u>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {failed.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <p className="hint" style={{ color: 'var(--cancel)', fontWeight: 700, marginBottom: 6 }}>
            تعذّر إنشاء {arNum(failed.length)} من السلاسل
          </p>
          <div className="prev">
            {failed.map((f) => (
              <div className="prow" key={f.slug}>
                <span>{f.slug}</span>
                <u>{f.message}</u>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="bar2">
        <button className="btn g" onClick={onCancel} disabled={busy}>
          {created.length > 0 ? 'إغلاق' : 'إلغاء'}
        </button>
        {created.length === 0 ? (
          <button className="btn p" onClick={upload} disabled={busy || !fileName}>
            {busy ? 'جارٍ الاستيراد…' : 'استيراد'}
          </button>
        ) : null}
      </div>
    </>
  )
}
