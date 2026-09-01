import {
  CANCELLED_CHIP,
  PILL_CLASS,
  ROW_CLASS,
  STATUS_LABEL,
  TYPE_CLASS,
  TYPE_LABEL,
  arNum,
  dayKey,
  hijriDate,
  hijriMonthDays,
  hijriMonthStart,
  hijriMonthYear,
  hijriParts,
  timeOfDay,
  weekday,
  weekdayIndex,
} from './datetime'
import type { LectureStatus, LectureType, LectureView } from './types'

/**
 * نموذج العرض — يُبنى في الخادم وحده.
 *
 * القاعدة الحاكمة: **الخادم يُنسّق، والعميل يعرض.**
 *
 * سبب هذه القاعدة أن `Intl` ليست دالّة نقيّة عبر البيئات: مخرج التاريخ الهجري
 * وأسماء الأيام والوقت يعتمد على إصدار ICU وعلى نظام الأرقام المحلول. لو نسّق
 * الخادم والمتصفح كلٌّ على حدة، فاختلافُ محرف واحد غير مرئي — علامة اتجاه
 * أو مسافة غير فاصلة — يُنتج عدم تطابق ترطيب على كل صفّ في الجدول.
 *
 * فيتلقّى العميل نصوصاً جاهزة وأرقاماً مطلقة، ولا يلمس `Intl` إطلاقاً.
 * الاستثناء الوحيد شبكة التقويم حين ينتقل الزائر إلى شهر آخر — لا مقابل
 * خادمياً لها أصلاً فلا مقارنة ترطيب.
 *
 * ولذلك أيضاً تُمرَّر اللحظات أرقاماً (`startsAtMs`) لا سلاسل: فلا يحلّل
 * المتصفح تاريخاً، ولا يقع في اختلاف تحليل الصيغ بين المحرّكات.
 */

export interface LectureVM {
  id: string
  seriesId: string
  /** فارغ إن لم تُوجد السلسلة في الخريطة — فلا يُبنى رابط */
  seriesSlug: string
  title: string
  book: string | null
  sheikhName: string
  sheikhSlug: string

  /** الترتيب: رقم مجرّد يبدأ من ١، بلا «من ١٢»، ويظهر في اللقاء المنفرد */
  ordAr: string

  // ---- عمود «الموعد»: نصّ واحد يجمع الهجري واليوم والوقت والمدة ----
  hijri: string
  weekdayName: string
  time: string
  durationAr: string

  /** مفتاح مطابقة خلية التقويم — 2026-08-31 بتوقيت الرياض */
  dayKey: string

  /** لحظتان مطلقتان للعدّاد وللتسليح على حدّ الحالة */
  startsAtMs: number
  endsAtMs: number

  // ---- النوع والوجهة ----
  type: LectureType
  typeLabel: string
  typeClass: string
  place: string
  mapUrl: string | null
  joinUrl: string | null

  // ---- الحالة: من v_lectures، لا تُحسب هنا ولا في العميل (القاعدة ٦.١) ----
  status: LectureStatus
  statusLabel: string
  rowClass: string
  pillClass: string
  isCancelled: boolean
  /** وسم الشارة حين الإلغاء — «ملغى» */
  cancelledChip: string
}

export function toLectureVM(
  l: LectureView,
  seriesSlugs: Map<string, { slug: string; title: string }>
): LectureVM {
  const starts = new Date(l.starts_at)

  return {
    id: l.id,
    seriesId: l.series_id,
    seriesSlug: seriesSlugs.get(l.series_id)?.slug ?? '',
    title: l.title,
    book: l.book,
    sheikhName: l.sheikh_name,
    sheikhSlug: l.sheikh_slug,

    ordAr: arNum(l.ord),

    hijri: hijriDate(starts),
    weekdayName: weekday(starts),
    time: timeOfDay(starts),
    durationAr: arNum(l.duration_min),

    dayKey: dayKey(starts),

    startsAtMs: starts.getTime(),
    endsAtMs: new Date(l.ends_at).getTime(),

    type: l.type,
    typeLabel: TYPE_LABEL[l.type],
    typeClass: TYPE_CLASS[l.type],
    place: l.place,
    mapUrl: l.map_url,
    joinUrl: l.join_url,

    status: l.status,
    statusLabel: STATUS_LABEL[l.status],
    rowClass: ROW_CLASS[l.status],
    pillClass: PILL_CLASS[l.status],
    isCancelled: l.is_cancelled,
    cancelledChip: CANCELLED_CHIP,
  }
}

/** خيار في قائمة تصفية المشايخ */
export interface SheikhOptionVM {
  slug: string
  name: string
}

// ============================================================
// شبكة الشهر الهجري
// ============================================================

export interface MonthVM {
  /** المرساة التي بُني منها الشهر — تُستعمل للتنقّل */
  anchorMs: number
  /** ربيع الأول ١٤٤٨ هـ */
  title: string
  /** عدد الخلايا الفارغة قبل أول يوم، بحسب موقعه من الأسبوع */
  lead: number
  days: { dayKey: string; dayAr: string }[]
}

/**
 * يبني شبكة الشهر الهجري الذي يقع فيه التاريخ.
 *
 * تُستدعى في الخادم لشهر البداية — فيتطابق أول تصيير مع HTML الخادم حرفياً —
 * وفي المتصفح وحده حين ينتقل الزائر إلى شهر آخر، ولا مقابل خادمياً لذلك
 * الشهر فلا مقارنة ترطيب أصلاً.
 */
export function buildMonthVM(anchor: Date | number): MonthVM {
  const at = typeof anchor === 'number' ? new Date(anchor) : anchor
  const start = hijriMonthStart(at)

  return {
    anchorMs: at.getTime(),
    title: hijriMonthYear(start),
    lead: weekdayIndex(start),
    days: hijriMonthDays(start).map((d) => ({
      dayKey: dayKey(d),
      dayAr: arNum(hijriParts(d).day),
    })),
  }
}

/** ما يحتاجه شريط البطل — نصوص جاهزة ولحظات مطلقة */
export interface HeroVM {
  title: string
  book: string | null
  sheikhName: string
  weekdayName: string
  hijri: string
  time: string
  startsAtMs: number
  status: 'upcoming' | 'live'
}

export function toHeroVM(vm: LectureVM): HeroVM {
  return {
    title: vm.title,
    book: vm.book,
    sheikhName: vm.sheikhName,
    weekdayName: vm.weekdayName,
    hijri: vm.hijri,
    time: vm.time,
    startsAtMs: vm.startsAtMs,
    // البطل لا يُبنى إلا من لقاء قادم أو جارٍ — الملغى والمنتهي لا يصلانه
    status: vm.status === 'live' ? 'live' : 'upcoming',
  }
}
