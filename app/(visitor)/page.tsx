import { filterLectures, getLectures, getSeriesSlugMap, getSheikhOptions } from '@/lib/queries'
import { dayKey } from '@/lib/datetime'
import { buildMonthVM, toHeroVM, toLectureVM } from '@/lib/view-model'
import type { LectureType, Period } from '@/lib/types'
import { VisitorApp } from '@/components/visitor/VisitorApp'

/**
 * الصفحة الرئيسية — جدول اللقاءات وتقويمها.
 *
 * القاعدة ٦.٢: لا تخزين مؤقّت. العرض `v_lectures` يستعمل `now()`، وأي تخزين
 * يجمّد «جارٍ الآن» والعدّاد.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

const TYPES: LectureType[] = ['onsite', 'remote', 'hybrid']

function readParam(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams

  // التصفية الثلاث المسموحة وحدها — لا بحث نصّي ولا فرز بالأعمدة (القسم ١٠)
  const period: Period = readParam(sp.period) === 'past' ? 'past' : 'upcoming'
  const sheikhParam = readParam(sp.sheikh)
  const typeParam = readParam(sp.type)
  const type = (TYPES as string[]).includes(typeParam) ? (typeParam as LectureType) : ''

  const [rows, sheikhs, slugMap] = await Promise.all([
    getLectures(),
    getSheikhOptions(),
    getSeriesSlugMap(),
  ])

  // ⚠️ معامل الشيخ يُتحقَّق منه كما يُتحقَّق من النوع. معامل غير مطابق لأي شيخ
  // نشط — أو مطابق لشيخ غير نشط أخرجته القاعدة ٦.٦ من التصفية — كان يُطبَّق
  // صامتاً: الجدول مصفّى والقائمة تقول «كل المشايخ»، فلا يرى الزائر تصفية
  // مفروضة عليه ولا يجد سبيلاً إلى إزالتها. والقسم ٧ يوجب أن تكون قابلة للإزالة.
  const sheikhSlug = sheikhs.some((s) => s.slug === sheikhParam) ? sheikhParam : ''

  // لحظة واحدة للطلب كلّه: يستعملها الترشيح والعدّاد وخلية «اليوم»،
  // فلا يختلف تصيير الخادم عن أول تصيير في المتصفح.
  const now = Date.now()

  const allVms = rows.map((l) => toLectureVM(l, slugMap))
  const tableRows = filterLectures(
    rows,
    { period, sheikhSlug: sheikhSlug || undefined, type: type || undefined },
    now
  ).map((l) => toLectureVM(l, slugMap))

  // البطل: الجارِي إن وُجد، وإلا أقرب قادم — يُشتقّ من القائمة المجلوبة أصلاً
  // بقراءة `status` من العرض، لا بإعادة حساب ولا باستعلام ثانٍ.
  const featured = rows.find((l) => l.status === 'live') ?? rows.find((l) => l.status === 'upcoming')
  const hero = featured ? toHeroVM(toLectureVM(featured, slugMap)) : null

  // الاسم من قائمة المشايخ لا من اللقاءات: شيخ نشط بلا لقاءات بعد كان يُسقط
  // الشريط كلّه، والنموذج يُظهره لأي شيخ مُختار بلا شرط
  const activeSheikhName = sheikhSlug
    ? (sheikhs.find((s) => s.slug === sheikhSlug)?.name ?? null)
    : null

  const publicLink = activeSheikhName
    ? {
        text: `صفحة ${activeSheikhName} — رابط يُرسَل إليه:`,
        path: `/sheikh/${sheikhSlug}`,
        backHref: '/',
      }
    : null

  return (
    <VisitorApp
      hero={hero}
      tableRows={tableRows}
      allRows={allVms}
      sheikhs={sheikhs}
      period={period}
      sheikhSlug={sheikhSlug}
      type={type}
      initialMonth={buildMonthVM(now)}
      todayKey={dayKey(now)}
      serverNow={now}
      publicLink={publicLink}
    />
  )
}
