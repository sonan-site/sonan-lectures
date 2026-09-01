import 'server-only'

/**
 * حجب تصاعدي بعد المحاولات الفاشلة — القسم ٧:
 * «كلمة مرور خاطئة ⇐ رسالة عربية، وتأخير تصاعدي بعد خمس محاولات فاشلة
 *  من العنوان نفسه».
 *
 * الحجب لا التأخير: إبقاء الاتصال مفتوحاً ثوانيَ عقوبةً يستهلك دالّة الخادم
 * ويصير هو نفسه باباً لإرهاق الخدمة. فنردّ فوراً بمدّة الانتظار المتبقّية.
 *
 * ⚠️ الذاكرة هنا محلّية للعملية الواحدة. على Vercel قد تتعدّد النسخ فيبدأ
 * العدّ من جديد في نسخة أخرى. وهذا مقبول للغرض — الحماية من التخمين اليدوي
 * لا من هجوم موزّع — والبديل جدول في قاعدة البيانات، وهو تعديل على المخطط
 * (توقّف إجباري بالقسم ١١). مذكور في `DECISIONS.md` تحت الفجوات.
 */

const FREE_ATTEMPTS = 5
const BASE_BLOCK_S = 5
const MAX_BLOCK_S = 300
/** تُنسى المحاولات بعد ساعة من آخر واحدة، فلا تتضخّم الخريطة */
const FORGET_AFTER_MS = 60 * 60 * 1000
const MAX_ENTRIES = 5000

interface Entry {
  fails: number
  blockedUntil: number
  seen: number
}

const attempts = new Map<string, Entry>()

function sweep(now: number): void {
  if (attempts.size < MAX_ENTRIES) return
  for (const [key, e] of attempts) {
    if (now - e.seen > FORGET_AFTER_MS) attempts.delete(key)
  }
  // لو بقيت متضخّمة رغم الكنس، نُفرغها بدل أن تنمو بلا حدّ
  if (attempts.size >= MAX_ENTRIES) attempts.clear()
}

/** كم ثانية بقيت على الحجب — صفر إن كان مسموحاً */
export function blockedFor(key: string, now: number = Date.now()): number {
  const e = attempts.get(key)
  if (!e) return 0
  if (now - e.seen > FORGET_AFTER_MS) {
    attempts.delete(key)
    return 0
  }
  return e.blockedUntil > now ? Math.ceil((e.blockedUntil - now) / 1000) : 0
}

/** يسجّل محاولة فاشلة ويعيد مدّة الحجب الجديدة بالثواني */
export function recordFailure(key: string, now: number = Date.now()): number {
  sweep(now)
  const e = attempts.get(key) ?? { fails: 0, blockedUntil: 0, seen: now }
  e.fails += 1
  e.seen = now

  if (e.fails > FREE_ATTEMPTS) {
    // ٥ ثوانٍ ثم ١٠ ثم ٢٠ … بسقف خمس دقائق
    const seconds = Math.min(BASE_BLOCK_S * 2 ** (e.fails - FREE_ATTEMPTS - 1), MAX_BLOCK_S)
    e.blockedUntil = now + seconds * 1000
    attempts.set(key, e)
    return seconds
  }

  attempts.set(key, e)
  return 0
}

/** نجاح الدخول يمسح السجلّ */
export function clearFailures(key: string): void {
  attempts.delete(key)
}

/**
 * عنوان الطالب من ترويسات الوكيل.
 *
 * على Vercel تأتي `x-forwarded-for` من الحافة وهي موثوقة هناك. وفي التشغيل
 * المحلّي قد تغيب فنقع على `local`. ولا يُبنى على هذا العنوان أي قرار صلاحية
 * — إنما عدّ محاولات فحسب، فانتحاله لا يفتح باباً بل يعيد العدّاد وحده.
 */
export function clientKey(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'local'
}
