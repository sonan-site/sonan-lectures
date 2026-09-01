/**
 * التاريخ والوقت — منقولة حرفياً من `prototype/index.html` المعتمد.
 *
 * قاعدتان تحكمان هذا الملف:
 *   ٦.٣ · الميلادي مصدر الحقيقة. التخزين `timestamptz`، والهجري للعرض وحده.
 *   ADR-0002 · العدّاد والحالة يعملان على لحظة مطلقة، فلا يتأثران باختلاف
 *              تقدير بداية الشهر الهجري. وقد يُزاح المعروض يوماً — وهذا مقبول.
 *
 * كل المُنسِّقات تُبنى مرة واحدة عند تحميل الوحدة: بناء `Intl.DateTimeFormat`
 * مكلف، وإعادته في كل صفّ من الجدول تُبطئ العرض بلا داعٍ.
 *
 * الوحدة صالحة في الخادم والمتصفح معاً — لا تعتمد إلا على `Intl`.
 */

export const TZ = 'Asia/Riyadh'

/** يوم كامل بالمللي ثانية — الرياض بلا توقيت صيفي، فالخطوة المطلقة تحفظ ساعة الحائط */
const DAY_MS = 86_400_000

/**
 * الوسوم مثبَّتة بـ `nu-arab` عمداً.
 * `ar-SA` وحدها تحلّ اليوم إلى الأرقام العربية-الهندية، لكن ذلك تابع لإصدار ICU
 * ولتفضيلات المستخدم. متصفّح يحلّها إلى `latn` يعطي «12:14 م» بينما `arNum`
 * تُخرج «١٢» — فتختلط الأرقام في الصفّ الواحد ويختلف مخرج الخادم عن المتصفح.
 */
const HIJRI = 'ar-SA-u-ca-islamic-umalqura-nu-arab'
const ARABIC = 'ar-SA-u-nu-arab'

/** ١٨ ربيع الأول ١٤٤٨ هـ */
const fHijri = new Intl.DateTimeFormat(HIJRI, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
})

/** ربيع الأول ١٤٤٨ هـ — لعنوان التقويم */
const fHijriMonthYear = new Intl.DateTimeFormat(HIJRI, {
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
})

/** أجزاء هجرية رقمية — تُبنى عليها شبكة التقويم */
const fHijriParts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: TZ,
})

/** الاثنين */
const fWeekday = new Intl.DateTimeFormat(ARABIC, { weekday: 'long', timeZone: TZ })

/** Mon — لحساب إزاحة أول الشهر في الشبكة */
const fWeekdayEn = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ })

/** ٨:٠٠ م */
const fTime = new Intl.DateTimeFormat(ARABIC, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: TZ,
})

/** 20:00 — لحقل الوقت في نماذج اللوحة (ساعة ٢٤ بلا رموز) */
const fClock = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
})

/** 2026-08-31 — مفتاح مطابقة اليوم بتوقيت الرياض */
const fDayKey = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TZ,
})

// ---------- الأرقام ----------

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** ١٢ ← 12 */
export const arNum = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)])

/** ٠٧ ← 7 */
export const arPad2 = (n: number): string => arNum(String(n).padStart(2, '0'))

// ---------- التحويل ----------

/** أي صيغة للحظة: كائن، أو نصّ ISO، أو مللي ثانية مطلقة */
export type DateLike = Date | string | number

const toDate = (v: DateLike): Date => (v instanceof Date ? v : new Date(v))

/** ١٨ ربيع الأول ١٤٤٨ هـ */
export const hijriDate = (v: DateLike): string => fHijri.format(toDate(v))

/** ربيع الأول ١٤٤٨ هـ */
export const hijriMonthYear = (v: DateLike): string => fHijriMonthYear.format(toDate(v))

/** الاثنين */
export const weekday = (v: DateLike): string => fWeekday.format(toDate(v))

/** ٨:٠٠ م */
export const timeOfDay = (v: DateLike): string => fTime.format(toDate(v))

/** 2026-08-31 — للمطابقة بين اللقاء وخلية التقويم، ولحقل التاريخ في اللوحة */
export const dayKey = (v: DateLike): string => fDayKey.format(toDate(v))

/** 20:00 بتوقيت الرياض — لحقل `<input type="time">` */
export const clockTime = (v: DateLike): string => fClock.format(toDate(v))

/** رقم اليوم من الأسبوع بتوقيت الرياض: ٠ الأحد … ٦ السبت */
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const weekdayIndex = (v: DateLike): number =>
  WEEK_EN.indexOf(fWeekdayEn.format(toDate(v)))

export interface HijriParts {
  day: number
  month: number
  year: number
}

/** أجزاء التاريخ الهجري رقمياً — لبناء شبكة الشهر */
export function hijriParts(v: DateLike): HijriParts {
  const out: Partial<HijriParts> = {}
  for (const p of fHijriParts.formatToParts(toDate(v))) {
    if (p.type === 'day' || p.type === 'month' || p.type === 'year') {
      out[p.type] = Number(p.value)
    }
  }
  return out as HijriParts
}

/**
 * خطوة يوم واحد بالزمن المطلق.
 *
 * ⚠️ لا تستعمل `setDate(getDate() ± 1)` هنا. تلك تخطو «يوماً محلّياً» بتوقيت
 * جهاز الزائر، وهو ٢٣ أو ٢٥ ساعة عند انتقال التوقيت الصيفي — فتنزلق ساعة
 * الرياض عبر منتصف الليل، ويُكرَّر يوم ويُفقد آخر في شبكة الشهر.
 *
 * أُعيد إنتاج الخطأ فعلياً: زائر بتوقيت Europe/Berlin، انطلاقاً من
 * ٢٠٢٦-٠٣-٢٧ بتوقيت الرياض، تعطي `setDate` التسلسل
 * «… ٠٣-٢٩ · ٠٣-٢٩ · ٠٣-٣١ …» — يوم ٣٠ يختفي، ولقاؤه يختفي من التقويم
 * بينما يظهر في الجدول. وهو بعينه تعارض «الجدول ضدّ التقويم» في القاعدة ٦.١.
 *
 * الرياض بلا توقيت صيفي، فخطوة ٢٤ ساعة مطلقة تحفظ ساعة الحائط بها تماماً.
 */
const stepDay = (d: Date, delta: number): Date => new Date(d.getTime() + delta * DAY_MS)

/**
 * أول يوم في الشهر الهجري الذي يقع فيه التاريخ.
 * نمشي إلى الوراء يوماً يوماً لأن أطوال الأشهر الهجرية غير ثابتة،
 * والحدّ ٣٢ حارس يمنع دوراناً بلا نهاية لو شذّ التقويم.
 */
export function hijriMonthStart(v: DateLike): Date {
  let d = toDate(v)
  let guard = 0
  while (hijriParts(d).day !== 1 && guard++ < 32) {
    d = stepDay(d, -1)
  }
  return d
}

/** كل أيام الشهر الهجري الذي يقع فيه التاريخ */
export function hijriMonthDays(v: DateLike): Date[] {
  const start = hijriMonthStart(v)
  const month = hijriParts(start).month
  const days: Date[] = []
  let cursor = start
  while (hijriParts(cursor).month === month && days.length < 31) {
    days.push(cursor)
    cursor = stepDay(cursor, 1)
  }
  return days
}

/**
 * بداية الشهر الهجري السابق أو التالي — لزرّي التنقّل في التقويم.
 * `delta = -1` للسابق و `+1` للتالي.
 *
 * النموذج ينقل بـ `setDate(-1)` و`setDate(+40)`، وكلاهما يقع في الفخّ نفسه.
 */
export function hijriMonthShift(v: DateLike, delta: -1 | 1): Date {
  const start = hijriMonthStart(v)
  return hijriMonthStart(delta < 0 ? stepDay(start, -1) : stepDay(start, 40))
}

// ---------- العدّاد ----------

export interface Countdown {
  days: number
  hours: number
  minutes: number
  /** أقلّ من ٢٤ ساعة ⇐ يُعرض «ساعة:دقيقة» بلون تنبيهي */
  soon: boolean
}

/**
 * ما تبقّى حتى بداية اللقاء.
 *
 * هذه **ليست** إعادة حساب للحالة (القاعدة ٦.١) — الحالة تأتي من `v_lectures`.
 * هذا عدّاد عرضٍ يعمل في المتصفح بمؤقّت لا بطلب من الخادم (القاعدة ٦.٢).
 */
export function countdown(startsAt: DateLike, now: number = Date.now()): Countdown {
  const ms = Math.max(0, toDate(startsAt).getTime() - now)
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  return {
    days,
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    soon: days < 1,
  }
}

/** كم دقيقة مضت على بداية اللقاء الجارٍ */
export const minutesSince = (startsAt: DateLike, now: number = Date.now()): number =>
  Math.max(0, Math.floor((now - toDate(startsAt).getTime()) / 60_000))

// ---------- نصوص ----------

export const TYPE_LABEL: Record<'onsite' | 'remote' | 'hybrid', string> = {
  onsite: 'حضوري',
  remote: 'عن بُعد',
  hybrid: 'حضوري وعن بُعد',
}

export const STATUS_LABEL: Record<'upcoming' | 'live' | 'done' | 'cancelled', string> = {
  upcoming: 'قادم',
  live: 'جارٍ الآن',
  done: 'انتهى',
  cancelled: 'أُلغي',
}

/**
 * وسم الشارة في عمود «النوع» حين يُلغى اللقاء.
 * النموذج المعتمد يستعمل «ملغى» في الشارة و«أُلغي» في عمود العدّاد والنافذة —
 * صيغتان متعمّدتان: الأولى صفة للقاء، والثانية فعل عمّا جرى. نُبقيهما كما هما.
 */
export const CANCELLED_CHIP = 'ملغى'

// ---------- جسر القيم إلى أصناف النموذج ----------
//
// قاعدة البيانات تعيد onsite|remote|hybrid و upcoming|live|done|cancelled،
// وأصناف النموذج المعتمد مختصرة: on|rem|mix و live|off|pastp…
// لا تشتقّ اسم الصنف من قيمة قاعدة البيانات مباشرة — `chip onsite` صنف
// لا وجود له في الورقة، فتظهر الشارة بيضاء بلا لون ولا حدّ.

/** صنف شارة النوع: .chip.on · .chip.rem · .chip.mix */
export const TYPE_CLASS: Record<'onsite' | 'remote' | 'hybrid', string> = {
  onsite: 'on',
  remote: 'rem',
  hybrid: 'mix',
}

/** صنف صفّ الجدول والبطاقة: tr.live · tr.off */
export const ROW_CLASS: Record<'upcoming' | 'live' | 'done' | 'cancelled', string> = {
  upcoming: '',
  live: 'live',
  done: '',
  cancelled: 'off',
}

/** صنف مؤشّر خلية التقويم: .pill · .pill.livep · .pill.offp · .pill.pastp */
export const PILL_CLASS: Record<'upcoming' | 'live' | 'done' | 'cancelled', string> = {
  upcoming: '',
  live: 'livep',
  done: 'pastp',
  cancelled: 'offp',
}

/** تمييز المفرد والمثنى والجمع — «لقاء» و«لقاءان» و«لقاءات» و«لقاءً» */
export function pluralLectures(n: number): string {
  if (n === 1) return 'لقاء واحد'
  if (n === 2) return 'لقاءان'
  if (n >= 3 && n <= 10) return `${arNum(n)} لقاءات`
  return `${arNum(n)} لقاءً`
}
