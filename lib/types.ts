/**
 * أنواع المشروع — مشتقّة حرفياً من `docs/schema.sql`.
 * لا تُعدَّل هنا إلا إذا تغيّر المخطط (وذاك توقّف إجباري بالقسم ١١).
 */

/** نوع اللقاء — القيم الثلاث المحسومة في `lecture_type` */
export type LectureType = 'onsite' | 'remote' | 'hybrid'

/**
 * حالة اللقاء — **مشتقّة في قاعدة البيانات لا محسوبة هنا** (القاعدة ٦.١).
 * تأتي جاهزة من العرض `v_lectures`، ولا يُعاد حسابها في الواجهة بأي حال،
 * وإلا اختلفت الحالة بين الجدول والتقويم.
 */
export type LectureStatus = 'upcoming' | 'live' | 'done' | 'cancelled'

/**
 * صفّ من العرض `v_lectures` — كل ما تحتاجه الواجهة في استعلام واحد.
 * الوراثة محسومة فيه: لقاء ← سلسلة ← إعدادات.
 */
export interface LectureView {
  id: string
  series_id: string
  /**
   * مرجع قالب الشيخ — **قد يكون `null`** بعد هجرة ٠٠٢.
   * حذف الشيخ من قائمة القوالب يُفرّغه ولا يمسّ الاسم ولا الرابط،
   * فهما لقطة محفوظة داخل السلسلة نفسها. لا تعتمد عليه في العرض.
   */
  sheikh_id: string | null
  /** لقطة الاسم وقت إنشاء السلسلة — لا تتغيّر بتعديل القالب */
  sheikh_name: string
  /** لقطة الرابط — عليه تقوم صفحة `/sheikh/[slug]` والتصفية */
  sheikh_slug: string
  title: string
  /** الكتاب — نصّ حرّ اختياري، لا كيان (ADR-0001) */
  book: string | null
  /** الترتيب ضمن السلسلة، يبدأ من ١ */
  ord: number
  /** عدد لقاءات السلسلة — لشريط التقدّم في `/s/[slug]` */
  series_count: number
  /** لحظة مطلقة بصيغة ISO — مخزّنة UTC، تُعرض بتوقيت الرياض (ADR-0002) */
  starts_at: string
  duration_min: number
  ends_at: string
  type: LectureType
  /** غير فارغ أبداً: يرث السلسلة ثم مقر الجمعية من `settings` */
  place: string
  map_url: string | null
  join_url: string | null
  is_cancelled: boolean
  status: LectureStatus
}

export interface Sheikh {
  id: string
  name: string
  slug: string
  is_active: boolean
}

export interface Series {
  id: string
  title: string
  book: string | null
  /** مرجع القالب — `null` إن حُذف الشيخ من القائمة */
  sheikh_id: string | null
  /** لقطة الاسم والرابط — النموذج القالبي (هجرة ٠٠٢) */
  sheikh_name: string
  sheikh_slug: string
  /** غير `null` ⇐ مؤرشفة: تختفي عن الزائر وتبقى في اللوحة */
  archived_at: string | null
  type: LectureType
  place: string | null
  map_url: string | null
  join_url: string | null
  duration_min: number
  slug: string
}

export interface Settings {
  hq_place: string
  hq_map_url: string | null
  logo_url: string | null
}

/** خيار في قائمة تصفية المشايخ — من لقطات اللقاءات لا من جدول القوالب */
export interface SheikhOption {
  slug: string
  name: string
}

/** أي الحقبتين يعرض الزائر — تصفية «قادم/سابق» */
export type Period = 'upcoming' | 'past'

export interface LectureFilter {
  period?: Period
  sheikhSlug?: string
  type?: LectureType
  seriesId?: string
}

/**
 * خطأ قاعدة بيانات برسالة عربية جاهزة للعرض.
 * الغرض: ألّا يرى الزائر نصّاً إنجليزياً ولا شاشة بيضاء (القسم ٧).
 */
export class DbError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'DbError'
    this.cause = cause
  }
}
