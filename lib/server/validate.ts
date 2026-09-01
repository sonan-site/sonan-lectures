import 'server-only'
import type { LectureType } from '@/lib/types'

/**
 * تحقّق المدخلات قبل الكتابة.
 *
 * كل ما يصل من المتصفح يُعامَل مجهولَ النوع حتى يثبت. قيود قاعدة البيانات
 * حارسٌ أخير لا أول: رسالتها إنجليزية غامضة، والقسم ٧ يوجب رسالة عربية
 * مفهومة — فيُفحص هنا أولاً ليصل الخطأ بلغة يفهمها المشرف.
 */

/** الرياض بلا توقيت صيفي، فالإزاحة ثابتة +٣ على مدار السنة */
const RIYADH_OFFSET = '+03:00'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const LECTURE_TYPES: LectureType[] = ['onsite', 'remote', 'hybrid']

export class ValidationError extends Error {}

const bad = (m: string): never => {
  throw new ValidationError(m)
}

/** نصّ اختياري: الفراغ يصير `null` فيرث السلسلة */
export function optionalText(v: unknown, label: string, max = 300): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') bad(`${label}: قيمة غير صالحة.`)
  const t = (v as string).trim()
  if (t.length === 0) return null
  if (t.length > max) bad(`${label}: أطول من ${max} حرفاً.`)
  return t
}

export function requiredText(v: unknown, label: string, max = 300): string {
  const t = optionalText(v, label, max)
  if (!t) bad(`${label}: مطلوب.`)
  return t as string
}

/**
 * رابط اختياري — `http`/`https` فقط.
 *
 * المنع هنا ليس تجميلاً: القيمة تُعرض للزائر داخل `href`، ولو قُبلت
 * `javascript:` لصار كل زائر عرضةً لتنفيذ نصّ عند النقر.
 */
export function optionalUrl(v: unknown, label: string): string | null {
  const t = optionalText(v, label, 2000)
  if (!t) return null

  let parsed: URL
  try {
    parsed = new URL(t)
  } catch {
    bad(`${label}: ليس رابطاً صالحاً. ابدأه بـ https://`)
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    bad(`${label}: لا يُقبل إلا رابط https أو http.`)
  }
  return t
}

export function optionalDuration(v: unknown, label = 'المدة'): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isInteger(n)) bad(`${label}: يجب أن تكون رقماً صحيحاً بالدقائق.`)
  if (n < 5 || n > 600) bad(`${label}: بين ٥ و٦٠٠ دقيقة.`)
  return n
}

export function optionalType(v: unknown, label = 'النوع'): LectureType | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !LECTURE_TYPES.includes(v as LectureType)) {
    bad(`${label}: قيمة غير معروفة.`)
  }
  return v as LectureType
}

export function requiredType(v: unknown, label = 'النوع'): LectureType {
  const t = optionalType(v, label)
  if (!t) bad(`${label}: مطلوب.`)
  return t as LectureType
}

export function requiredSlug(v: unknown, label = 'رابط الصفحة'): string {
  const t = requiredText(v, label, 48).toLowerCase()
  if (!SLUG_RE.test(t)) bad(`${label}: حروف لاتينية صغيرة وأرقام وشُرَط فقط.`)
  return t
}

export function requiredUuid(v: unknown, label: string): string {
  const t = requiredText(v, label, 64)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    bad(`${label}: معرّف غير صالح.`)
  }
  return t
}

/**
 * تاريخ ووقت بتوقيت الرياض ← لحظة مطلقة.
 *
 * القاعدة ٦.٣: الإدخال ميلادي والتخزين `timestamptz`. والإزاحة مكتوبة
 * صراحةً `+03:00` لا مأخوذة من ساعة الخادم — فخادمٌ بتوقيت UTC وآخر
 * بتوقيت آخر يُنتجان اللحظة نفسها.
 */
export function riyadhToInstant(dateStr: unknown, timeStr: unknown): string {
  const d = requiredText(dateStr, 'التاريخ', 10)
  const t = requiredText(timeStr, 'الوقت', 5)
  if (!DATE_RE.test(d)) bad('التاريخ: الصيغة المطلوبة سنة-شهر-يوم.')
  if (!TIME_RE.test(t)) bad('الوقت: الصيغة المطلوبة ساعة:دقيقة.')

  const instant = new Date(`${d}T${t}:00${RIYADH_OFFSET}`)
  if (Number.isNaN(instant.getTime())) bad('التاريخ أو الوقت غير صالح.')

  // يمنع ٣١ فبراير وأمثاله: الشهر واليوم يجب أن يبقيا كما أُدخلا
  const back = new Date(instant.getTime() + 3 * 3600_000).toISOString().slice(0, 10)
  if (back !== d) bad(`التاريخ غير موجود في التقويم: ${d}`)

  return instant.toISOString()
}

/**
 * القاعدة ٦.٨ — لقاء غير حضوري بحت يلزمه رابط دخول.
 *
 * ⚠️ الفحص على القيمة **الفعّالة بعد الوراثة** لا على حقل اللقاء وحده:
 * قيد `series_link_required` يحرس السلسلة ولا يحرس تجاوز اللقاء المفرد،
 * فلقاءٌ غُيِّر نوعه إلى «عن بُعد» بلا رابطٍ فيه ولا في سلسلته يمرّ من
 * قاعدة البيانات سليماً ويصل الزائر بلا وجهة.
 */
export function assertJoinUrlRule(
  effectiveType: LectureType,
  effectiveJoinUrl: string | null
): void {
  if (effectiveType !== 'onsite' && !effectiveJoinUrl) {
    bad(
      effectiveType === 'remote'
        ? 'لقاء «عن بُعد» يلزمه رابط دخول. اكتب رابطاً هنا، أو ضعه في السلسلة ليرثه اللقاء.'
        : 'لقاء «حضوري وعن بُعد» يلزمه رابط دخول. اكتب رابطاً هنا، أو ضعه في السلسلة ليرثه اللقاء.'
    )
  }
}
