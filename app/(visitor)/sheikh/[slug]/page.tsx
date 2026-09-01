import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  filterLectures,
  getLectures,
  getSeriesSlugMap,
  getSheikhOptions,
  getSheikhPage,
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
  const sheikh = await getSheikhPage(slug)
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

  // الهوية من لقطة السلسلة لا من جدول القوالب: الرابط يبقى عاملاً بعد حذف
  // الشيخ من القائمة، ما دامت له سلسلة حيّة
  const sheikh = await getSheikhPage(slug)
  // رابط غير موجود ⇐ صفحة ٤٠٤ عربية (القسم ٧ · معيار القبول ١٠)
  if (!sheikh) notFound()

  const period: Period = readParam(sp.period) === 'past' ? 'past' : 'upcoming'
  const typeParam = readParam(sp.type)
  const type = (TYPES as string[]).includes(typeParam) ? (typeParam as LectureType) : ''

  const [rows, slugMap, activeSheikhs] = await Promise.all([
    getLectures({ sheikhSlug: slug }),
    getSeriesSlugMap(),
    getSheikhOptions(),
  ])

  // القائمة العامة، ويُضاف إليها شيخ الصفحة إن غاب عنها — كأن يكون قالبه
  // موسوماً غير نشط (٦.٦) أو محذوفاً — حتى تعرض اختياره الحالي بدل «كل المشايخ»
  const sheikhOptions = activeSheikhs.some((s) => s.slug === sheikh.slug)
    ? activeSheikhs
    : [{ slug: sheikh.slug, name: sheikh.name }, ...activeSheikhs]

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
