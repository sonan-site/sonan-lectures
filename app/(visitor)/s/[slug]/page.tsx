import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  filterLectures,
  getLecturesBySeriesId,
  getSeriesBySlug,
  getSeriesSlugMap,
  getSheikhs,
} from '@/lib/queries'
import { dayKey } from '@/lib/datetime'
import { buildMonthVM, toHeroVM, toLectureVM } from '@/lib/view-model'
import type { LectureType, Period } from '@/lib/types'
import { VisitorApp } from '@/components/visitor/VisitorApp'
import { SeriesHead } from '@/components/visitor/SeriesHead'

/**
 * صفحة السلسلة — «رأس تعريفي وشريط تقدّم، ثم لقاءاتها» (القسم ٥).
 *
 * وفيها يسقط عمودا «اللقاء» و«الشيخ» لأنهما ثابتان في السلسلة كلّها،
 * فتصير الأعمدة ستة.
 *
 * نصّ «أُنجز ٣ من ٦» في الرأس هو ما يفحصه معيار القبول ٩.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

function readParam(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const series = await getSeriesBySlug(slug)
  if (!series) return { title: 'الصفحة غير موجودة · جمعية سنن' }
  return {
    title: `${series.title} · جمعية سنن`,
    description: series.book
      ? `${series.title} — ${series.book}. جدول اللقاءات في جمعية سنن التعليمية.`
      : `${series.title}. جدول اللقاءات في جمعية سنن التعليمية.`,
  }
}

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams

  const series = await getSeriesBySlug(slug)
  // رابط غير موجود ⇐ صفحة ٤٠٤ عربية (القسم ٧)
  if (!series) notFound()

  const period: Period = readParam(sp.period) === 'past' ? 'past' : 'upcoming'
  // النوع يُقرأ هنا أيضاً: اللقاء المفرد يجوز أن يتجاوز نوع سلسلته،
  // فقائمة التصفية في الشريط تبقى عاملة لا زينةً معطّلة.
  const typeParam = readParam(sp.type)
  const type = (['onsite', 'remote', 'hybrid'] as string[]).includes(typeParam)
    ? (typeParam as LectureType)
    : ''

  const [rows, slugMap, activeSheikhs] = await Promise.all([
    getLecturesBySeriesId(series.id),
    getSeriesSlugMap(),
    getSheikhs(true),
  ])

  const now = Date.now()
  const allVms = rows.map((l) => toLectureVM(l, slugMap))
  const tableRows = filterLectures(rows, { period, type: type || undefined }, now).map((l) =>
    toLectureVM(l, slugMap)
  )

  // مرتّبةً زمنياً: getLecturesBySeriesId يرتّب بـord، ولقاءٌ أُجِّل قد يقع
  // بعد ما يليه في الترتيب — فيُعرض في البطل موعد بعيد بدل الأقرب فعلاً
  const byTime = [...rows].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  )
  const featured =
    byTime.find((l) => l.status === 'live') ?? byTime.find((l) => l.status === 'upcoming')
  const hero = featured ? toHeroVM(toLectureVM(featured, slugMap)) : null

  // اسم الشيخ من أول لقاء — العرض يحمله محسوماً، فلا استعلام إضافي
  const sheikhName = allVms[0]?.sheikhName ?? ''

  return (
    <VisitorApp
      hero={hero}
      tableRows={tableRows}
      allRows={allVms}
      sheikhs={activeSheikhs.map((s) => ({ slug: s.slug, name: s.name }))}
      period={period}
      sheikhSlug=""
      type={type}
      initialMonth={buildMonthVM(now)}
      todayKey={dayKey(now)}
      serverNow={now}
      sheikhMode="navigate"
      showSeriesColumns={false}
      publicLink={{
        text: 'رابط هذه السلسلة للنشر:',
        path: `/s/${series.slug}`,
        backHref: '/',
      }}
      header={
        <SeriesHead
          title={series.title}
          book={series.book}
          sheikhName={sheikhName}
          lectures={allVms}
        />
      }
    />
  )
}
