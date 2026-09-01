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
 * أما **الحالة** فمن `v_lectures` وحدها (القاعدة ٦.١): لا تُحسب هنا ولو
 * كانت البيانات كلها حاضرة.
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
  sheikh_id: string
}

/** صفّ اللقاء كما تعرضه اللوحة — نصوص جاهزة وقيم خام معاً */
export interface AdminLectureVM {
  id: string
  seriesId: string
  seriesTitle: string
  seriesBook: string | null
  sheikhName: string
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
}

/** صفّ الشيخ في تبويب المشايخ — بعدد سلاسله */
export interface AdminSheikhVM {
  id: string
  name: string
  slug: string
  isActive: boolean
  seriesCount: number
  seriesCountAr: string
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
}

export async function getAdminData(): Promise<AdminData> {
  const [rawRes, statusRes, sheikhRes, settingsRes] = await Promise.all([
    supabasePublic
      .from('lectures')
      .select(
        'id, series_id, ord, starts_at, duration_min, type, place, map_url, join_url, is_cancelled,' +
          ' series:series_id (id, title, book, slug, type, place, map_url, join_url, duration_min, sheikh_id)'
      )
      .order('starts_at', { ascending: true }),
    supabasePublic.from('v_lectures').select('id, status'),
    supabasePublic.from('sheikhs').select('id, name, slug, is_active').order('name'),
    supabasePublic.from('settings').select('hq_place, hq_map_url, logo_url').single(),
  ])

  if (rawRes.error) wrap('اللقاءات', rawRes.error)
  if (statusRes.error) wrap('حالات اللقاءات', statusRes.error)
  if (sheikhRes.error) wrap('المشايخ', sheikhRes.error)
  if (settingsRes.error) wrap('الإعدادات', settingsRes.error)

  const hqPlace = settingsRes.data?.hq_place ?? 'مقر جمعية سنن'
  const hqMapUrl = settingsRes.data?.hq_map_url ?? null
  const logoUrl = settingsRes.data?.logo_url ?? null

  const statusById = new Map<string, LectureStatus>(
    (statusRes.data ?? []).map((r) => [r.id as string, r.status as LectureStatus])
  )

  const sheikhNameById = new Map<string, string>(
    (sheikhRes.data ?? []).map((s) => [s.id as string, s.name as string])
  )

  const rawRows = (rawRes.data ?? []) as unknown as RawLectureRow[]

  const counts = new Map<string, number>()
  for (const row of rawRows) {
    counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1)
  }

  const lectures: AdminLectureVM[] = rawRows.map((row) => {
    const s = row.series

    const starts = new Date(row.starts_at)
    const ovDuration = row.duration_min
    const ovType = row.type
    const ovPlace = row.place
    const ovJoinUrl = row.join_url

    const effDuration = ovDuration ?? s.duration_min
    const effType = ovType ?? s.type

    return {
      id: row.id,
      seriesId: s.id,
      seriesTitle: s.title,
      seriesBook: s.book,
      sheikhName: sheikhNameById.get(s.sheikh_id) ?? '—',
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
      isOverridden: Boolean(ovDuration || ovType || ovPlace || ovJoinUrl),

      status: statusById.get(row.id) ?? 'upcoming',
      statusLabel: STATUS_LABEL[statusById.get(row.id) ?? 'upcoming'],
      startsAtMs: starts.getTime(),
    }
  })

  // سلسلة بلا لقاءات لا تظهر في الجدول أعلاه، فتُجلب القائمة كاملة على حدة
  const { data: allSeries, error: seriesErr } = await supabasePublic
    .from('series')
    .select('id, title, book, slug, type, place, map_url, join_url, duration_min, sheikh_id')
    .order('title')

  if (seriesErr) wrap('السلاسل', seriesErr)

  const series: AdminSeriesVM[] = (allSeries ?? []).map((s) => ({
    id: s.id as string,
    title: s.title as string,
    book: (s.book as string | null) ?? null,
    slug: s.slug as string,
    sheikhName: sheikhNameById.get(s.sheikh_id as string) ?? '—',
    type: s.type as LectureType,
    typeLabel: TYPE_LABEL[s.type as LectureType],
    typeClass: TYPE_CLASS[s.type as LectureType],
    count: counts.get(s.id as string) ?? 0,
    countAr: arNum(counts.get(s.id as string) ?? 0),
  }))

  // عدد سلاسل كل شيخ — من قائمة السلاسل الكاملة لا من اللقاءات
  const seriesPerSheikh = new Map<string, number>()
  for (const s of allSeries ?? []) {
    const sid = s.sheikh_id as string
    seriesPerSheikh.set(sid, (seriesPerSheikh.get(sid) ?? 0) + 1)
  }

  const allSheikhs: AdminSheikhVM[] = (sheikhRes.data ?? []).map((s) => {
    const n = seriesPerSheikh.get(s.id as string) ?? 0
    return {
      id: s.id as string,
      name: s.name as string,
      slug: s.slug as string,
      isActive: s.is_active as boolean,
      seriesCount: n,
      seriesCountAr: arNum(n),
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
  }
}
