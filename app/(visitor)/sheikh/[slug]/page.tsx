import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  filterLectures,
  getLectures,
  getSeriesSlugMap,
  getSheikhBySlug,
  getSheikhs,
} from '@/lib/queries'
import { dayKey } from '@/lib/datetime'
import { buildMonthVM, toHeroVM, toLectureVM } from '@/lib/view-model'
import type { LectureType, Period } from '@/lib/types'
import { VisitorApp } from '@/components/visitor/VisitorApp'

/**
 * صفحة الشيخ — «لقاءات شيخ واحد» (القسم ٥).
 *
 * رابط عام مقروء يُرسَل إلى الشيخ ليقرأ جدوله؛ لا حساب له ولا يحرّر شيئاً.
 *
 * ولا رأس مُخترَع هنا: النموذج المعتمد لا يحمل تصميماً لرأس صفحة الشيخ،
 * وشريط الرابط العام `#sbar` هو ما وضعه المصمّم لهذه الحال. ابتكار رأس
 * جديد انحرافٌ يحتاج إذناً (§١١).
 *
 * والأعمدة ثمانية كما هي: القسم ٥ يُسقط عمودَي «اللقاء» و«الشيخ» في صفحة
 * السلسلة وحدها، والنموذج نفسه لا يُسقطهما عند التصفية بالشيخ.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

const TYPES: LectureType[] = ['onsite', 'remote', 'hybrid']

function readParam(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const sheikh = await getSheikhBySlug(slug)
  if (!sheikh) return { title: 'الصفحة غير موجودة · جمعية سنن' }
  return {
    title: `لقاءات ${sheikh.name} · جمعية سنن`,
    description: `جدول اللقاءات العلمية لـ${sheikh.name} في جمعية سنن التعليمية.`,
  }
}

export default async function SheikhPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams

  const sheikh = await getSheikhBySlug(slug)
  // رابط غير موجود ⇐ صفحة ٤٠٤ عربية (القسم ٧ · معيار القبول ١٠)
  if (!sheikh) notFound()

  const period: Period = readParam(sp.period) === 'past' ? 'past' : 'upcoming'
  const typeParam = readParam(sp.type)
  const type = (TYPES as string[]).includes(typeParam) ? (typeParam as LectureType) : ''

  const [rows, slugMap, activeSheikhs] = await Promise.all([
    getLectures({ sheikhSlug: slug }),
    getSeriesSlugMap(),
    getSheikhs(true),
  ])

  // القائمة تحمل النشطين، ويُضاف إليها شيخ الصفحة إن كان غير نشط حتى تعرض
  // اختياره الحالي بدل «كل المشايخ» — والقاعدة ٦.٦ تُخرجه من التصفية لا من صفحته
  const sheikhOptions = activeSheikhs.some((s) => s.slug === sheikh.slug)
    ? activeSheikhs.map((s) => ({ slug: s.slug, name: s.name }))
    : [{ slug: sheikh.slug, name: sheikh.name }, ...activeSheikhs.map((s) => ({ slug: s.slug, name: s.name }))]

  const now = Date.now()
  const allVms = rows.map((l) => toLectureVM(l, slugMap))
  const tableRows = filterLectures(rows, { period, type: type || undefined }, now).map((l) =>
    toLectureVM(l, slugMap)
  )

  // البطل مقيَّد بنطاق الصفحة: عرض لقاء شيخ آخر في صفحة شيخ لا معنى له
  const featured = rows.find((l) => l.status === 'live') ?? rows.find((l) => l.status === 'upcoming')
  const hero = featured ? toHeroVM(toLectureVM(featured, slugMap)) : null

  return (
    <VisitorApp
      hero={hero}
      tableRows={tableRows}
      allRows={allVms}
      sheikhs={sheikhOptions}
      period={period}
      sheikhSlug={sheikh.slug}
      type={type}
      initialMonth={buildMonthVM(now)}
      todayKey={dayKey(now)}
      serverNow={now}
      sheikhMode="navigate"
      publicLink={{
        text: `صفحة ${sheikh.name} — رابط يُرسَل إليه:`,
        path: `/sheikh/${sheikh.slug}`,
        backHref: '/',
      }}
    />
  )
}
