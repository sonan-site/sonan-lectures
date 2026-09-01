import { supabasePublic } from './supabase-public'
import {
  DbError,
  type LectureFilter,
  type LectureView,
  type Series,
  type Settings,
  type Sheikh,
} from './types'

/**
 * طبقة القراءة — المصدر الوحيد لبيانات الواجهة.
 *
 * كل ما يُعرض يمرّ من هنا، فتبقى الحالة واحدة بين الجدول والتقويم
 * وصفحة الشيخ وصفحة السلسلة (القاعدة ٦.١).
 *
 * تُقرأ كلها بمفتاح `anon`: سياسات RLS تمنح القراءة للجميع (القاعدة ٦.٥).
 *
 * ⚠️ الصفحات التي تستدعي هذه الدوالّ يجب أن تعطّل التخزين المؤقّت
 *    (`dynamic = 'force-dynamic'` و `revalidate = 0`) لأن العرض يستعمل `now()`
 *    وأي تخزين يجمّد «جارٍ الآن» والعدّاد (القاعدة ٦.٢).
 */

/** يحوّل خطأ Supabase إلى خطأ برسالة عربية جاهزة للعرض */
function wrap(what: string, error: unknown): never {
  throw new DbError(`تعذّر جلب ${what}. قاعدة البيانات لا تستجيب حالياً.`, error)
}

// ============================================================
// الإعدادات
// ============================================================

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabasePublic
    .from('settings')
    .select('hq_place, hq_map_url, logo_url')
    .single()

  if (error || !data) wrap('إعدادات المنصة', error)
  return data as Settings
}

// ============================================================
// المشايخ
// ============================================================

/**
 * @param activeOnly الشيخ غير النشط يخرج من تصفية الزائر ومن اختيار السلسلة،
 *                   وتبقى لقاءاته ظاهرة في «السابقة» (القاعدة ٦.٦).
 */
export async function getSheikhs(activeOnly = true): Promise<Sheikh[]> {
  let q = supabasePublic.from('sheikhs').select('id, name, slug, is_active')
  if (activeOnly) q = q.eq('is_active', true)

  const { data, error } = await q.order('name')
  if (error) wrap('قائمة المشايخ', error)
  return (data ?? []) as Sheikh[]
}

/** يعيد `null` إن لم يوجد — فتعرض الصفحة ٤٠٤ عربية (القسم ٧) */
export async function getSheikhBySlug(slug: string): Promise<Sheikh | null> {
  const { data, error } = await supabasePublic
    .from('sheikhs')
    .select('id, name, slug, is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (error) wrap('بيانات الشيخ', error)
  return (data as Sheikh) ?? null
}

// ============================================================
// السلاسل
// ============================================================

export async function getSeriesBySlug(slug: string): Promise<Series | null> {
  const { data, error } = await supabasePublic
    .from('series')
    .select('id, title, book, sheikh_id, type, place, map_url, join_url, duration_min, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (error) wrap('بيانات السلسلة', error)
  return (data as Series) ?? null
}

/**
 * خريطة `series_id` ← رابط السلسلة وعنوانها.
 *
 * العرض `v_lectures` لا يحمل `series.slug`، وصفّ الجدول يحتاجه ليربط
 * عنوان اللقاء بصفحة سلسلته. فبدل تعديل العرض — وهو توقّف إجباري
 * بالقسم ١١ — نجلب الخريطة مرة واحدة للصفحة كلها.
 */
export async function getSeriesSlugMap(): Promise<Map<string, { slug: string; title: string }>> {
  const { data, error } = await supabasePublic.from('series').select('id, slug, title')
  if (error) wrap('روابط السلاسل', error)

  const map = new Map<string, { slug: string; title: string }>()
  for (const row of data ?? []) {
    map.set(row.id as string, { slug: row.slug as string, title: row.title as string })
  }
  return map
}

// ============================================================
// اللقاءات
// ============================================================

/**
 * أي الحقبتين ينتمي إليها اللقاء.
 *
 * الحالة نفسها تأتي من `v_lectures` ولا تُحسب هنا. الشيء الوحيد الذي يُقرَّر
 * محلياً هو **الوعاء**: اللقاء الملغى قد يكون قادماً وقد يكون ماضياً،
 * والحالة `cancelled` وحدها لا تفصل بينهما — فنرجع إلى `starts_at`.
 */
function isUpcomingBucket(l: LectureView, now: number): boolean {
  if (l.status === 'upcoming' || l.status === 'live') return true
  if (l.status === 'cancelled') return new Date(l.starts_at).getTime() > now
  return false
}

/**
 * ترشيح خالص على صفوف مجلوبة سلفاً.
 *
 * صفحة `/` تحتاج قائمتين من البيانات نفسها: مصفّاة للجدول، وكاملة للتقويم.
 * فتُجلب مرة واحدة وتُرشَّح هنا، بدل جولتين إلى قاعدة البيانات على صفحة
 * لا تخزين مؤقّت لها أصلاً (القاعدة ٦.٢).
 *
 * الترشيح يقع في الخادم لا في المتصفح: الوعاء «قادم/سابق» يعتمد على الحالة
 * الآتية من `v_lectures` وعلى اللحظة الراهنة، ولو رُشِّح في العميل على حمولة
 * قديمة لاختلف تصنيف اللقاء بين الجدول والتقويم — وهو ما تحذّر منه ٦.١.
 */
export function filterLectures(
  rows: LectureView[],
  filter: LectureFilter = {},
  now: number = Date.now()
): LectureView[] {
  let out = rows

  if (filter.sheikhSlug) out = out.filter((l) => l.sheikh_slug === filter.sheikhSlug)
  if (filter.type) out = out.filter((l) => l.type === filter.type)
  if (filter.seriesId) out = out.filter((l) => l.series_id === filter.seriesId)

  if (filter.period) {
    const wantUpcoming = filter.period === 'upcoming'
    out = out.filter((l) => isUpcomingBucket(l, now) === wantUpcoming)
    // القادم بالأقرب زمناً، والسابق بالأحدث أولاً — ترتيب ثابت بلا فرز يدوي
    out = [...out].sort((a, b) => {
      const d = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      return wantUpcoming ? d : -d
    })
  }

  return out
}

export async function getLectures(filter: LectureFilter = {}): Promise<LectureView[]> {
  let q = supabasePublic.from('v_lectures').select('*')

  // ما يمكن دفعه إلى قاعدة البيانات، يُدفع
  if (filter.sheikhSlug) q = q.eq('sheikh_slug', filter.sheikhSlug)
  if (filter.type) q = q.eq('type', filter.type)
  if (filter.seriesId) q = q.eq('series_id', filter.seriesId)

  const { data, error } = await q.order('starts_at', { ascending: true })
  if (error) wrap('جدول اللقاءات', error)

  const rows = (data ?? []) as LectureView[]
  // الترشيح بالشيخ والنوع والسلسلة تمّ في قاعدة البيانات؛ يبقى الوعاء الزمني
  return filter.period ? filterLectures(rows, { period: filter.period }) : rows
}

/**
 * لقاء شريط البطل: الجارِي الآن إن وُجد، وإلا أقربُ قادم.
 *
 * استعلام واحد يكفي: اللقاء الجارِي بدأ فعلاً، فترتيبه الزمني التصاعدي
 * يضعه قبل كل قادم.
 */
export async function getFeaturedLecture(): Promise<LectureView | null> {
  const { data, error } = await supabasePublic
    .from('v_lectures')
    .select('*')
    .in('status', ['live', 'upcoming'])
    .order('starts_at', { ascending: true })
    .limit(1)

  if (error) wrap('اللقاء القادم', error)
  return ((data ?? [])[0] as LectureView) ?? null
}

/** لقاءات سلسلة واحدة مرتّبةً بترتيبها — لصفحة `/s/[slug]` */
export async function getLecturesBySeriesId(seriesId: string): Promise<LectureView[]> {
  const { data, error } = await supabasePublic
    .from('v_lectures')
    .select('*')
    .eq('series_id', seriesId)
    .order('ord', { ascending: true })

  if (error) wrap('لقاءات السلسلة', error)
  return (data ?? []) as LectureView[]
}

/** كم أُنجز من السلسلة — لشريط التقدّم ونصّ «أُنجز ٣ من ٦» */
export function seriesProgress(lectures: LectureView[]): { done: number; total: number } {
  return {
    done: lectures.filter((l) => l.status === 'done').length,
    total: lectures.length,
  }
}

// لا تُعاد تصدير الأنواع من هنا عمداً.
// SWC يترجم ملفاً ملفاً ولا يعرف أن `Period` نوع، فسطر
// `import { Period } from '@/lib/queries'` بلا `type` في مكوّن عميل يبقى بعد
// الترجمة ويجرّ `supabase-public.ts` كاملاً إلى حزمة المتصفح — بما فيه رميته
// على مستوى الوحدة. الأنواع كلها من `@/lib/types`، والاستعلامات من هنا.
