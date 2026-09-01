'use client'

import { createContext, useContext, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * مصدر «اللحظة الراهنة» للصفحة كلها، ومحرّك تحديث الحالة.
 *
 * المبدأ الحاكم: **المتصفح يملك الأرقام، وقاعدة البيانات تملك الكلمات.**
 *
 * القاعدة ٦.٢ توجب أن يعمل العدّاد بمؤقّت في المتصفح لا بطلب من الخادم —
 * وهذا محقَّق: كل أرقام العدّاد تُحسب محلّياً بلا طلب واحد.
 *
 * والقاعدة ٦.١ تمنع أن تُحسب الحالة في الواجهة — وهذا محقَّق أيضاً: لا يرقّي
 * العميل لقاءً من «قادم» إلى «جارٍ الآن» بنفسه أبداً. كل ما يقرّره هو **متى
 * يسأل الخادم**، فيعيد الخادم قراءة `v_lectures` ويكون `now()` في Postgres
 * هو من يحسم الحالة.
 *
 * ثلاثة محرّكات للتحديث:
 *   ١. مسلَّح على الحدّ  — أقرب لحظة يتغيّر عندها شيء (بداية لقاء قادم أو
 *      نهاية لقاء جارٍ). مؤقّت واحد للصفحة، دقيق إلى الثانية.
 *   ٢. عند العودة       — تبديل التبويب أو عودة الشبكة.
 *   ٣. شبكة احتياطية    — كل دقيقة والصفحة ظاهرة، لالتقاط ما لا حدّ له:
 *      لقاء أضافه المشرف، أو إلغاء قُلب، أو مكان تغيّر.
 *
 * ولا يعمل شيء من ذلك والصفحة مخفيّة — فلا تُستنزف قاعدة البيانات بتبويبات
 * منسيّة على صفحة بلا تخزين مؤقّت.
 */

const NowContext = createContext<number>(0)

/** اللحظة الراهنة بالمللي ثانية — تتحدّث كل دقيقة على حدّ الدقيقة */
export const useNow = (): number => useContext(NowContext)

/** هامش أمان بعد الحدّ، يستوعب انحراف ساعة المتصفح عن ساعة الخادم */
const BOUNDARY_GRACE_MS = 2_000
const FALLBACK_MS = 60_000
/** سقف `setTimeout` — عدد صحيح ٣٢ بت موجب */
const MAX_TIMEOUT_MS = 2_147_483_647

export function NowProvider({
  serverNow,
  boundaries,
  children,
}: {
  /** لحظة الخادم — تُستعمل في أول تصيير فيتطابق مع HTML الخادم حرفياً */
  serverNow: number
  /** لحظات تغيّر الحالة: بداية كل «قادم» ونهاية كل «جارٍ» */
  boundaries: number[]
  children: React.ReactNode
}) {
  const [now, setNow] = useState(serverNow)
  const router = useRouter()
  const [, startTransition] = useTransition()

  // ── ١ · نبضة العرض ─────────────────────────────────────────
  // أول تصيير يستعمل serverNow فيطابق HTML الخادم، ثم تنتقل إلى ساعة المتصفح
  // بعد الترطيب. الدقّة بالدقيقة، فنُسلّح على حدّ الدقيقة التالية بدل نبضة ثابتة.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }

    setNow(Date.now())
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(timer)
  }, [])

  // ── ٢ · التسليح على أقرب حدّ ───────────────────────────────
  // `boundaries.join()` في قائمة التبعيات لأن المصفوفة تتغيّر هويّتها كل تصيير
  const boundaryKey = boundaries.join(',')
  useEffect(() => {
    const next = boundaries.filter((b) => b > Date.now()).sort((a, b) => a - b)[0]
    if (next === undefined) return

    let timer: ReturnType<typeof setTimeout>

    /**
     * ⚠️ التسليح يُعاد على دفعات لا مرّة واحدة.
     *
     * `setTimeout` يحوّل مهلته إلى عدد صحيح ٣٢ بت: أي مهلة تتجاوز
     * ٢٬١٤٧٬٤٨٣٬٦٤٧ مللي ثانية (نحو ٢٤٫٨ يوماً) تنقلب سالبةً وتُقصّ إلى صفر،
     * فتنطلق فوراً. وفترة انقطاع بين فصلين — أقرب لقاء بعد أربعين يوماً —
     * كانت تُنتج تحديثاً فورياً بلا سبب ثم لا تُعيد التسليح أبداً، فتسقط
     * الآلية كلها في الحالة التي وُضعت لها.
     */
    const arm = () => {
      const remaining = next - Date.now() + BOUNDARY_GRACE_MS
      if (remaining <= 0) {
        if (document.visibilityState === 'visible') {
          startTransition(() => router.refresh())
        }
        return
      }
      timer = setTimeout(arm, Math.min(remaining, MAX_TIMEOUT_MS))
    }

    arm()
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryKey, router])

  // ── ٣ · العودة والشبكة الاحتياطية ──────────────────────────
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      setNow(Date.now())
      startTransition(() => router.refresh())
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    const interval = setInterval(refresh, FALLBACK_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
      clearInterval(interval)
    }
  }, [router])

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>
}
