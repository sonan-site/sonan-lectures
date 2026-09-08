import 'server-only'
import type { LectureType } from '@/lib/types'
import { TYPE_LABEL } from '@/lib/datetime'
import {
  ValidationError,
  assertJoinUrlRule,
  optionalDuration,
  optionalText,
  optionalUrl,
  requiredSlug,
  requiredText,
  riyadhToInstant,
} from './validate'

/**
 * تحقّق ملف الاستيراد وتجميعه — منطق خالص بلا اتصال بقاعدة البيانات،
 * فيبقى قابلاً للاختبار بمعزل عن Route Handler (`scripts/check-import-export.mjs`
 * يستدعيه مباشرة). قراءة `exceljs` نفسها تبقى في المسار
 * (`app/api/admin/series/import/route.ts`) — هذا الملف لا يعرف عن ملفات
 * إكسل شيئاً، فقط عن صفوف مجرَّدة.
 *
 * ⚠️ **الفلسفة**: كل صفّ يُفحص، وكل خطأ يُجمَع في قائمة — لا توقّف عند أول
 * خطأ. هذا امتداد للقسم ٧ («فشل توليد التواريخ ⇐ منع الحفظ، لا إنشاء
 * سلسلة بلا لقاءات») على مستوى الملف كله: يُصلِح المشرف كل شيء في تمريرة
 * واحدة بدل تجربة-وخطأ متكرّرة معه.
 */

/** صفّ خام من ورقة الإكسل — كل قيمة كما وصلت من الخلية، بلا تحقّق بعد */
export interface ImportRow {
  /** رقم الصفّ في الورقة كما يراه المستخدم في Excel (للرسائل) */
  row: number
  seriesSlug: unknown
  title: unknown
  book: unknown
  /** شيخ هذا اللقاء تحديداً — لكل صفّ، لا ثابت على مستوى المجموعة (هجرة ٠٠٣) */
  sheikhSlug: unknown
  scopeFrom: unknown
  scopeTo: unknown
  typeLabel: unknown
  place: unknown
  mapUrl: unknown
  joinUrl: unknown
  duration: unknown
  date: unknown
  time: unknown
}

export interface RowIssue {
  row: number
  message: string
}

export interface ImportLecture {
  row: number
  startsAt: string
  sheikhSlug: string
  scopeFrom: string | null
  scopeTo: string | null
}

/** مجموعة سلسلة صالحة — جاهزة للإدخال في قاعدة البيانات */
export interface ValidSeriesGroup {
  /** أول صفّ في الملف يحمل هذا الرابط — لرسائل عدم التطابق */
  firstRow: number
  slug: string
  title: string
  book: string | null
  type: LectureType
  place: string | null
  mapUrl: string | null
  joinUrl: string | null
  durationMin: number
  lectures: ImportLecture[]
}

const TYPE_LABEL_TO_VALUE: Record<string, LectureType> = Object.fromEntries(
  (Object.entries(TYPE_LABEL) as [LectureType, string][]).map(([k, v]) => [v, k])
)

function typeFromLabel(v: unknown): LectureType {
  const t = requiredText(v, 'النوع', 30)
  const type = TYPE_LABEL_TO_VALUE[t]
  if (!type) {
    throw new ValidationError(
      `النوع: القيمة «${t}» غير معروفة. استعمل إحدى قيم القائمة المنسدلة: ${Object.values(TYPE_LABEL).join(' · ')}.`
    )
  }
  return type
}

/**
 * الحقول الثابتة على مستوى السلسلة — يجب أن تتطابق على كل صفوف الرابط نفسه.
 * «رابط الشيخ» و«مقدار من/إلى» **ليست هنا عمداً** (هجرة ٠٠٣): تخصّ كل لقاء
 * وحده، وتختلف حرّةً بين صفوف السلسلة الواحدة (خلاف الكتاب والعنوان).
 */
const SHARED_FIELDS: { key: keyof ImportRow; label: string }[] = [
  { key: 'title', label: 'عنوان اللقاء' },
  { key: 'book', label: 'الكتاب' },
  { key: 'typeLabel', label: 'النوع' },
  { key: 'place', label: 'المكان' },
  { key: 'mapUrl', label: 'رابط الخرائط' },
  { key: 'joinUrl', label: 'رابط الدخول' },
  { key: 'duration', label: 'المدة' },
]

/** يطبَّع القيمة لمقارنة متسامحة مع الفراغات الزائدة، لا للتخزين */
function normForCompare(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/**
 * يجمّع صفوف الملف حسب «رابط السلسلة»، ويتحقّق من كل صفّ ومن اتساق كل
 * مجموعة، ويعيد المجموعات الصالحة مع كل الأخطاء المكتشفة معاً — لا
 * يتوقّف عند أول خطأ.
 *
 * فحصا قاعدة البيانات (الرابط غير مستعمَل سلفاً، الشيخ موجود ونشط) ليسا
 * هنا: هذا المنطق خالص بلا اتصال، وتلك الفحوص تقع في المسار بعد نجاح هذا.
 */
export function parseImportRows(rows: ImportRow[]): {
  groups: ValidSeriesGroup[]
  issues: RowIssue[]
} {
  const issues: RowIssue[] = []
  const push = (row: number, message: string) => issues.push({ row, message })

  // ---------- التجميع حسب رابط السلسلة ----------
  const bySlug = new Map<string, ImportRow[]>()
  for (const r of rows) {
    let slug: string
    try {
      slug = requiredSlug(r.seriesSlug, 'رابط السلسلة')
    } catch (e) {
      push(r.row, e instanceof ValidationError ? e.message : 'رابط السلسلة: قيمة غير صالحة.')
      continue
    }
    const list = bySlug.get(slug) ?? []
    list.push(r)
    bySlug.set(slug, list)
  }

  const groups: ValidSeriesGroup[] = []

  for (const [slug, groupRows] of bySlug) {
    const firstRow = groupRows[0].row

    // ---------- اتساق الحقول المشتركة ----------
    let consistent = true
    for (const { key, label } of SHARED_FIELDS) {
      const first = normForCompare(groupRows[0][key])
      for (const r of groupRows.slice(1)) {
        if (normForCompare(r[key]) !== first) {
          push(
            r.row,
            `عمود «${label}» يختلف عن أول صفّ لهذه السلسلة (${slug}) في الصف ${firstRow}. كل أعمدة السلسلة يجب أن تتطابق على كل صفوفها.`
          )
          consistent = false
        }
      }
    }
    if (!consistent) continue

    const head = groupRows[0]
    let title: string, book: string | null
    let type: LectureType, place: string | null, mapUrl: string | null, joinUrl: string | null
    let durationMin: number
    let headOk = true

    try {
      title = requiredText(head.title, 'عنوان اللقاء', 200)
    } catch (e) {
      push(firstRow, e instanceof ValidationError ? e.message : 'عنوان اللقاء: قيمة غير صالحة.')
      headOk = false
      title = ''
    }
    try {
      book = optionalText(head.book, 'الكتاب', 200)
    } catch (e) {
      push(firstRow, e instanceof ValidationError ? e.message : 'الكتاب: قيمة غير صالحة.')
      headOk = false
      book = null
    }
    try {
      type = typeFromLabel(head.typeLabel)
    } catch (e) {
      push(firstRow, e instanceof ValidationError ? e.message : 'النوع: قيمة غير صالحة.')
      headOk = false
      type = 'onsite'
    }
    try {
      place = type === 'remote' ? null : optionalText(head.place, 'المكان', 200)
    } catch (e) {
      push(firstRow, e instanceof ValidationError ? e.message : 'المكان: قيمة غير صالحة.')
      headOk = false
      place = null
    }
    try {
      mapUrl = type === 'remote' ? null : optionalUrl(head.mapUrl, 'رابط الخرائط')
    } catch (e) {
      push(firstRow, e instanceof ValidationError ? e.message : 'رابط الخرائط: قيمة غير صالحة.')
      headOk = false
      mapUrl = null
    }
    try {
      joinUrl = type === 'onsite' ? null : optionalUrl(head.joinUrl, 'رابط الدخول')
    } catch (e) {
      push(firstRow, e instanceof ValidationError ? e.message : 'رابط الدخول: قيمة غير صالحة.')
      headOk = false
      joinUrl = null
    }
    try {
      durationMin = optionalDuration(head.duration, 'المدة') ?? 90
    } catch (e) {
      push(firstRow, e instanceof ValidationError ? e.message : 'المدة: قيمة غير صالحة.')
      headOk = false
      durationMin = 90
    }

    try {
      assertJoinUrlRule(type!, joinUrl!)
    } catch (e) {
      push(firstRow, e instanceof ValidationError ? e.message : 'رابط الدخول: مطلوب لهذا النوع.')
      headOk = false
    }

    // ---------- كل لقاء: التاريخ والوقت وشيخه ومقداره — حقول اللقاء وحده ----------
    const lectures: ImportLecture[] = []
    const seenInstants = new Map<string, number>()
    let lecturesOk = true

    for (const r of groupRows) {
      let startsAt: string
      try {
        startsAt = riyadhToInstant(r.date, r.time)
      } catch (e) {
        push(r.row, e instanceof ValidationError ? e.message : 'التاريخ أو الوقت: قيمة غير صالحة.')
        lecturesOk = false
        continue
      }
      const dupRow = seenInstants.get(startsAt)
      if (dupRow !== undefined) {
        push(r.row, `نفس التاريخ والوقت داخل السلسلة «${slug}» مكرَّر مع الصفّ ${dupRow} — احذف أحدهما.`)
        lecturesOk = false
        continue
      }

      // رابط الشيخ إلزاميّ لكل صفّ: السلسلة المستورَدة لا تكسب شيخاً افتراضياً
      // أبداً (قرار محسوم — كل لقاء يحمل شيخه صراحةً، مطابقةً للملف الحقيقي
      // المُرفَق حتى لو تكرّر الرابط نفسه في كل صفوف السلسلة).
      let rowSheikhSlug: string
      try {
        rowSheikhSlug = requiredSlug(r.sheikhSlug, 'رابط الشيخ')
      } catch (e) {
        push(r.row, e instanceof ValidationError ? e.message : 'رابط الشيخ: قيمة غير صالحة.')
        lecturesOk = false
        continue
      }

      let rowScopeFrom: string | null, rowScopeTo: string | null
      try {
        rowScopeFrom = optionalText(r.scopeFrom, 'مقدار من', 300)
        rowScopeTo = optionalText(r.scopeTo, 'مقدار إلى', 300)
      } catch (e) {
        push(r.row, e instanceof ValidationError ? e.message : 'المقدار: قيمة غير صالحة.')
        lecturesOk = false
        continue
      }

      seenInstants.set(startsAt, r.row)
      lectures.push({
        row: r.row,
        startsAt,
        sheikhSlug: rowSheikhSlug,
        scopeFrom: rowScopeFrom,
        scopeTo: rowScopeTo,
      })
    }

    if (!headOk || !lecturesOk || lectures.length === 0) continue

    lectures.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0))

    groups.push({
      firstRow,
      slug,
      title: title!,
      book: book!,
      type: type!,
      place: place!,
      mapUrl: mapUrl!,
      joinUrl: joinUrl!,
      durationMin: durationMin!,
      lectures,
    })
  }

  // ترتيب النتائج بأول ظهور في الملف — تسهيلاً لقراءة رسائل النجاح لاحقاً
  groups.sort((a, b) => a.firstRow - b.firstRow)
  issues.sort((a, b) => a.row - b.row)

  return { groups, issues }
}
