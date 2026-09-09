import { supabasePublic } from './supabase-public'
import { DbError, type LectureType, type LectureStatus } from './types'
import {
  STATUS_LABEL,
  TYPE_CLASS,
  TYPE_LABEL,
  arNum,
  clockTime,
  dayKey,
  hijriDate,
  timeOfDay,
  weekday,
} from './datetime'

/**
 * قراءة بيانات لوحة التحكم.
 *
 * تُقرأ بمفتاح `anon` كواجهة الزائر — سياسات RLS تمنح القراءة للجميع،
 * والمحتوى معلَن أصلاً. مفتاح الخدمة للكتابة وحدها (القاعدتان ٦.٤ و٦.٥).
 *
 * ⚠️ اللوحة تقرأ جدول `lectures` **الخام** لا العرض `v_lectures`: العرض
 * يحسم الوراثة فيعيد القيمة النهائية، واللوحة تحتاج أن تعرف أي حقل
 * مكتوبٌ في اللقاء وأيّه موروثٌ من سلسلته — فتُظهر الموروث نصّاً إرشادياً
 * وتَسِم الخارج عن سلسلته.
 *
 * أما **الحالة** فمن العرض وحده (القاعدة ٦.١): لا تُحسب هنا ولو كانت
 * البيانات كلها حاضرة.
 *
 * ⚠️ والعرض المقروء هو `v_lectures_admin` لا `v_lectures`: العام صار يُخفي
 * المؤرشف بعد هجرة ٠٠٢، فلو قُرئ هنا لغابت حالات اللقاءات المؤرشفة وسقطت
 * افتراضاً إلى «قادم» — فيرى المشرف ماضياً على أنه قادم. والإداري يعرض كل
 * شيء بلا ترشيح، ويحمل معه ختمَي الأرشفة.
 */

function wrap(what: string, error: unknown): never {
  throw new DbError(`تعذّر جلب ${what}. قاعدة البيانات لا تستجيب حالياً.`, error)
}

/**
 * عميل Supabase بلا أنواع مولَّدة من المخطط يستنتج نتائج التضمين استنتاجاً
 * فضفاضاً. فتُوصَف الصفوف هنا صراحةً — وهي مطابقة لـ`docs/schema.sql`.
 */
interface RawLectureRow {
  id: string
  series_id: string
  ord: number
  starts_at: string
  duration_min: number | null
  type: LectureType | null
  place: string | null
  map_url: string | null
  join_url: string | null
  is_cancelled: boolean
  archived_at: string | null
  /** الشيخ المُتجاوِز على هذا اللقاء تحديداً — `null` يعني وارثاً (هجرة ٠٠٣) */
  sheikh_id: string | null
  sheikh_name: string | null
  sheikh_slug: string | null
  /** مقدار هذا اللقاء — بلا وراثة إطلاقاً، لا نظير له على السلسلة (هجرة ٠٠٣) */
  scope_from: string | null
  scope_to: string | null
  series: RawSeries
}

interface RawSeries {
  id: string
  title: string
  book: string | null
  slug: string
  type: LectureType
  place: string | null
  map_url: string | null
  join_url: string | null
  duration_min: number
  /** `null` إن حُذف الشيخ من قائمة القوالب، أو إن لم يكن لها شيخ افتراضي أصلاً */
  sheikh_id: string | null
  /**
   * اللقطة — قد تكون `null` منذ هجرة ٠٠٣: سلسلة تناوب كامل (كل لقاء بشيخه
   * الخاص) لا شيخ افتراضي لها إطلاقاً، لا قالباً محذوفاً. الفرق بينهما في
   * `sheikh_id` وحده — انظر `sheikhTemplateGone` أدناه.
   */
  sheikh_name: string | null
  sheikh_slug: string | null
  archived_at: string | null
}

/** صفّ اللقاء كما تعرضه اللوحة — نصوص جاهزة وقيم خام معاً */
export interface AdminLectureVM {
  id: string
  seriesId: string
  seriesTitle: string
  seriesBook: string | null
  /** الفعّال بعد التغليب (لقاء فسلسلة) — للعرض المباشر */
  sheikhName: string

  /** التجاوز كما هو على اللقاء: `null` يعني وارثاً */
  ovSheikhId: string | null
  /** الفحص الصحيح لـ«هل الشيخ متجاوَز؟» — لا `ovSheikhId` (مرجع قد يُفرَّغ بحذف القالب وتبقى اللقطة) */
  ovSheikhName: string | null
  /** ما يرثه من السلسلة — `null` إن كانت السلسلة بلا شيخ افتراضي (تناوب كامل) */
  inhSheikhName: string | null

  /** مقدار هذا اللقاء — بلا وراثة، لا نظير له على السلسلة */
  scopeFrom: string | null
  scopeTo: string | null
  /** أحد حقلَي المقدار مملوء على الأقل — شارة "المقدار" المستقلّة */
  hasScope: boolean

  ordAr: string

  /** نصوص العرض */
  hijri: string
  weekdayName: string
  time: string
  /** قيم حقول النموذج بتوقيت الرياض */
  dateInput: string
  timeInput: string

  /** القيم الفعّالة بعد الوراثة — لعرض الجدول */
  effDuration: number
  effDurationAr: string
  effType: LectureType
  effTypeLabel: string
  effTypeClass: string

  /** التجاوزات كما هي في اللقاء: `null` يعني موروثاً */
  ovDuration: number | null
  ovType: LectureType | null
  ovPlace: string | null
  ovJoinUrl: string | null

  /** ما يرثه من السلسلة — يظهر نصّاً إرشادياً داخل الحقل */
  inhDuration: number
  inhType: LectureType
  inhTypeLabel: string
  inhPlace: string
  inhJoinUrl: string | null

  isCancelled: boolean
  /** مؤرشف — مخفيّ عن الزائر، ظاهر هنا */
  isArchived: boolean
  /** سلسلته مؤرشفة — فهو مخفيّ عن الزائر تبعاً لها */
  seriesArchived: boolean
  /** خرج عن سلسلته في حقل واحد على الأقل ⇐ وسم «مختلف عن السلسلة» */
  isOverridden: boolean

  /** من `v_lectures` وحده — لا يُحسب هنا (القاعدة ٦.١) */
  status: LectureStatus
  statusLabel: string
  startsAtMs: number
}

export interface AdminSeriesVM {
  id: string
  title: string
  book: string | null
  slug: string
  sheikhName: string
  type: LectureType
  typeLabel: string
  typeClass: string
  count: number
  countAr: string
  isArchived: boolean
  /** حُذف قالب شيخها من القائمة — واللقطة باقية */
  sheikhTemplateGone: boolean
}

/** صفّ الشيخ في تبويب المشايخ — بعدد سلاسله ولقاءاته المتجاوِزة */
export interface AdminSheikhVM {
  id: string
  name: string
  slug: string
  isActive: boolean
  seriesCount: number
  seriesCountAr: string
  /** لقاءات تتجاوز عليه مباشرة (لا عبر سلسلة) — تذكرها نافذة الحذف أيضاً */
  overriddenLectureCount: number
  overriddenLectureCountAr: string
}

export interface AdminData {
  lectures: AdminLectureVM[]
  series: AdminSeriesVM[]
  /** كل المشايخ — النشط وغيره، لتبويب المشايخ */
  allSheikhs: AdminSheikhVM[]
  /** النشطون وحدهم — لاختيار السلسلة (القاعدة ٦.٦) */
  sheikhs: { id: string; name: string; slug: string }[]
  hqPlace: string
  hqMapUrl: string | null
  logoUrl: string | null
  logoScale: number
}

export async function getAdminData(): Promise<AdminData> {
  const [rawRes, statusRes, sheikhRes, settingsRes] = await Promise.all([
    supabasePublic
      .from('lectures')
      .select(
        'id, series_id, ord, starts_at, duration_min, type, place, map_url, join_url,' +
          ' is_cancelled, archived_at, sheikh_id, sheikh_name, sheikh_slug, scope_from, scope_to,' +
          ' series:series_id (id, title, book, slug, type, place, map_url, join_url,' +
          ' duration_min, sheikh_id, sheikh_name, sheikh_slug, archived_at)'
      )
      .order('starts_at', { ascending: true }),
    supabasePublic.from('v_lectures_admin').select('id, status'),
    supabasePublic.from('sheikhs').select('id, name, slug, is_active').order('name'),
    supabasePublic.from('settings').select('hq_place, hq_map_url, logo_url, logo_scale').single(),
  ])

  if (rawRes.error) wrap('اللقاءات', rawRes.error)
  if (statusRes.error) wrap('حالات اللقاءات', statusRes.error)
  if (sheikhRes.error) wrap('المشايخ', sheikhRes.error)
  if (settingsRes.error) wrap('الإعدادات', settingsRes.error)

  const hqPlace = settingsRes.data?.hq_place ?? 'مقر جمعية سنن'
  const hqMapUrl = settingsRes.data?.hq_map_url ?? null
  const logoUrl = settingsRes.data?.logo_url ?? null
  const logoScale = settingsRes.data?.logo_scale ?? 100

  const statusById = new Map<string, LectureStatus>(
    (statusRes.data ?? []).map((r) => [r.id as string, r.status as LectureStatus])
  )

  const rawRows = (rawRes.data ?? []) as unknown as RawLectureRow[]

  const counts = new Map<string, number>()
  // توزيع الشيخ الفعّال عبر لقاءات كل سلسلة — يُستعمَل حصراً لسلاسل بلا
  // شيخ افتراضي (تناوب كامل) لحساب «يتناوب (Nشيخاً)» أدناه.
  const sheikhNamesBySeriesId = new Map<string, Set<string>>()
  for (const row of rawRows) {
    counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1)
    const effName = row.sheikh_name ?? row.series.sheikh_name
    if (effName) {
      const set = sheikhNamesBySeriesId.get(row.series_id) ?? new Set<string>()
      set.add(effName)
      sheikhNamesBySeriesId.set(row.series_id, set)
    }
  }

  const lectures: AdminLectureVM[] = rawRows.map((row) => {
    const s = row.series

    const starts = new Date(row.starts_at)
    const ovDuration = row.duration_min
    const ovType = row.type
    const ovPlace = row.place
    const ovJoinUrl = row.join_url
    const ovSheikhId = row.sheikh_id
    const ovSheikhName = row.sheikh_name

    const effDuration = ovDuration ?? s.duration_min
    const effType = ovType ?? s.type
    const scopeFrom = row.scope_from
    const scopeTo = row.scope_to

    return {
      id: row.id,
      seriesId: s.id,
      seriesTitle: s.title,
      seriesBook: s.book,
      // الفعّال بعد التغليب: تجاوز اللقاء أولاً، ثم لقطة السلسلة
      sheikhName: ovSheikhName ?? s.sheikh_name ?? '',

      ovSheikhId,
      ovSheikhName,
      inhSheikhName: s.sheikh_name,

      scopeFrom,
      scopeTo,
      hasScope: Boolean(scopeFrom || scopeTo),

      ordAr: arNum(row.ord),

      hijri: hijriDate(starts),
      weekdayName: weekday(starts),
      time: timeOfDay(starts),
      dateInput: dayKey(starts),
      timeInput: clockTime(starts),

      effDuration,
      effDurationAr: arNum(effDuration),
      effType,
      effTypeLabel: TYPE_LABEL[effType],
      effTypeClass: TYPE_CLASS[effType],

      ovDuration,
      ovType,
      ovPlace,
      ovJoinUrl,

      inhDuration: s.duration_min,
      inhType: s.type,
      inhTypeLabel: TYPE_LABEL[s.type],
      inhPlace: s.place ?? hqPlace,
      inhJoinUrl: s.join_url,

      isCancelled: row.is_cancelled,
      isArchived: row.archived_at !== null,
      seriesArchived: s.archived_at !== null,
      // ovSheikhName لا ovSheikhId: مرجع قد يُفرَّغ بحذف قالب الشيخ وتبقى
      // اللقطة صحيحة — فحص المرجع وحده كان سيُخفي تجاوزاً حقيقياً.
      isOverridden: Boolean(ovDuration || ovType || ovPlace || ovJoinUrl || ovSheikhName),

      status: statusById.get(row.id) ?? 'upcoming',
      statusLabel: STATUS_LABEL[statusById.get(row.id) ?? 'upcoming'],
      startsAtMs: starts.getTime(),
    }
  })

  // سلسلة بلا لقاءات لا تظهر في الجدول أعلاه، فتُجلب القائمة كاملة على حدة
  const { data: allSeries, error: seriesErr } = await supabasePublic
    .from('series')
    .select(
      'id, title, book, slug, type, place, map_url, join_url, duration_min,' +
        ' sheikh_id, sheikh_name, sheikh_slug, archived_at'
    )
    .order('title')

  if (seriesErr) wrap('السلاسل', seriesErr)

  const seriesRows = (allSeries ?? []) as unknown as RawSeries[]

  const series: AdminSeriesVM[] = seriesRows.map((s) => {
    // لا شيخ افتراضي (تناوب كامل، هجرة ٠٠٣) ⇐ يُحسَب اسم العرض من توزيع
    // لقاءاتها الفعلي، لا من عمود لا قيمة فيه. هذا عرض إداري وحده، ليس في
    // ADR-0005 نفسها.
    let sheikhName = s.sheikh_name ?? ''
    if (s.sheikh_name === null) {
      const distinct = [...(sheikhNamesBySeriesId.get(s.id) ?? [])]
      sheikhName = distinct.length === 1 ? distinct[0] : `يتناوب (${arNum(distinct.length)}شيخاً)`
    }

    return {
      id: s.id,
      title: s.title,
      book: s.book,
      slug: s.slug,
      sheikhName,
      type: s.type,
      typeLabel: TYPE_LABEL[s.type],
      typeClass: TYPE_CLASS[s.type],
      count: counts.get(s.id) ?? 0,
      countAr: arNum(counts.get(s.id) ?? 0),
      isArchived: s.archived_at !== null,
      // ثلاث حالات: شيخ حاضر (كلاهما غير فارغ) · قالب محذوف واللقطة باقية
      // (sheikh_id فارغ وsheikh_name باقٍ) · لا شيخ افتراضي أصلاً (كلاهما
      // فارغ، تناوب كامل) — هذه الأخيرة ليست «قالباً محذوفاً» فلا تُوسَم به.
      sheikhTemplateGone: s.sheikh_id === null && s.sheikh_name !== null,
    }
  })

  // عدد سلاسل كل شيخ — من قائمة السلاسل الكاملة لا من اللقاءات
  // يُعدّ بالمرجع لا باللقطة: العدد يجيب «كم سلسلة ما زالت مرتبطة بهذا القالب»
  // وهو ما يُذكر في تأكيد الحذف. والسلسلة التي فُرّغ مرجعها لا تُنسب إلى أحد.
  const seriesPerSheikh = new Map<string, number>()
  for (const s of seriesRows) {
    const sid = s.sheikh_id
    if (!sid) continue
    seriesPerSheikh.set(sid, (seriesPerSheikh.get(sid) ?? 0) + 1)
  }

  // لقاءات تتجاوز على هذا الشيخ مباشرة — منفصل عن seriesPerSheikh لأن حذف
  // القالب لا يمسّ اللقطة في أيّهما، لكن نافذة الحذف تذكر الاثنين معاً
  const overriddenLecturesPerSheikh = new Map<string, number>()
  for (const l of lectures) {
    if (!l.ovSheikhId) continue
    overriddenLecturesPerSheikh.set(l.ovSheikhId, (overriddenLecturesPerSheikh.get(l.ovSheikhId) ?? 0) + 1)
  }

  const allSheikhs: AdminSheikhVM[] = (sheikhRes.data ?? []).map((s) => {
    const n = seriesPerSheikh.get(s.id as string) ?? 0
    const m = overriddenLecturesPerSheikh.get(s.id as string) ?? 0
    return {
      id: s.id as string,
      name: s.name as string,
      slug: s.slug as string,
      isActive: s.is_active as boolean,
      seriesCount: n,
      seriesCountAr: arNum(n),
      overriddenLectureCount: m,
      overriddenLectureCountAr: arNum(m),
    }
  })

  return {
    lectures,
    series,
    allSheikhs,
    // القاعدة ٦.٦: غير النشط يخرج من اختيار السلسلة
    sheikhs: allSheikhs
      .filter((s) => s.isActive)
      .map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
    hqPlace,
    hqMapUrl,
    logoUrl,
    logoScale,
  }
}
