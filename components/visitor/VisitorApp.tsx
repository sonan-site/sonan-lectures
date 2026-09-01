'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Period } from '@/lib/types'
import type { LectureVM, MonthVM, SheikhOptionVM, HeroVM } from '@/lib/view-model'
import { NowProvider } from './NowProvider'
import { Hero } from './Hero'
import { TopBar, type View } from './TopBar'
import { LectureTable } from './LectureTable'
import { MobileCards } from './MobileCards'
import { CalendarView } from './CalendarView'
import { LectureDialog } from './LectureDialog'
import { emptyKind } from './EmptyState'

/**
 * الغلاف التفاعلي لواجهة الزائر.
 *
 * يُصيَّر في الخادم أولاً (مكوّن عميل لا يعني عميلاً فقط)، فيصل الزائر إلى
 * HTML كامل مفهرَس، ثم يترطّب فتعمل التبويبات والنافذة والعدّاد.
 *
 * كل البيانات تصله جاهزة من الخادم: نصوصاً منسَّقة وأرقاماً مطلقة. لا استعلام
 * ولا `Intl` ولا حساب حالة هنا (القاعدة ٦.١).
 *
 * القسمان — الجدول والتقويم — يُصيَّران معاً ويُبدَّل بينهما بسمة `hidden`
 * كما في النموذج، فالتبديل فوري بلا جولة إلى الخادم.
 */
export function VisitorApp({
  hero,
  tableRows,
  allRows,
  sheikhs,
  period,
  sheikhSlug,
  type,
  initialMonth,
  todayKey,
  serverNow,
  publicLink,
  sheikhMode = 'filter',
  showSeriesColumns = true,
  header,
}: {
  hero: HeroVM | null
  /** الصفوف بعد التصفية — للجدول والبطاقات */
  tableRows: LectureVM[]
  /** كل صفوف نطاق الصفحة بلا تصفية — للتقويم وللنافذة */
  allRows: LectureVM[]
  sheikhs: SheikhOptionVM[]
  period: Period
  sheikhSlug: string
  type: string
  initialMonth: MonthVM
  todayKey: string
  serverNow: number
  /**
   * شريط الرابط العام `#sbar` — يظهر حين للصفحة رابط يُنشر أو يُرسَل.
   * في النموذج كان يطبع المسار نصّاً ليُظهر أن الصفحة موجودة؛ وقد صارت
   * مساراً حقيقياً، فبقي الشريط بهيئته يعرض الرابط ويقود إلى ما قبله.
   */
  publicLink?: { text: string; path: string; backHref: string } | null
  /** ما تفعله قائمة المشايخ: تضبط تصفية في `/`، أو تنتقل إلى صفحة الشيخ في الفرعية */
  sheikhMode?: 'filter' | 'navigate'
  showSeriesColumns?: boolean
  /** رأس خاص بالصفحة (رأس السلسلة مثلاً) يُدرَج فوق الجدول */
  header?: React.ReactNode
}) {
  const router = useRouter()
  const [view, setView] = useState<View>('table')

  /**
   * ⚠️ الحالة تحفظ **مُعرِّفاً** لا كائناً.
   *
   * حفظ كائن اللقاء يُجمّده لحظة الفتح: حين يُطلق `NowProvider` أمر التحديث
   * عند بلوغ حدّ الحالة، يعيد الخادم `status='live'` فينقلب الصفّ خلف النافذة
   * وشريط البطل، وتبقى النافذة تقول «قادم» ويبقى عدّادها على ٠٠:٠٠ — أي
   * تختلف الحالة بين عرضين للصفحة نفسها، وهو نصّ ما تمنعه القاعدة ٦.١.
   * ودون ٩٦٠ بكسل النافذة هي العرض الوحيد للتفاصيل، فالخطأ يقع على الجوال حصراً.
   */
  const [dialogKey, setDialogKey] = useState<
    { kind: 'lecture'; id: string } | { kind: 'day'; dayKey: string } | null
  >(null)

  // لحظات تغيّر الحالة: بداية كل قادم، ونهاية كل جارٍ.
  // عليها يُسلَّح مؤقّت واحد يطلب من الخادم إعادة قراءة v_lectures.
  const boundaries = useMemo(
    () =>
      allRows
        .map((l) => (l.status === 'upcoming' ? l.startsAtMs : l.status === 'live' ? l.endsAtMs : 0))
        .filter((n) => n > 0),
    [allRows]
  )

  const byId = useMemo(() => new Map(allRows.map((l) => [l.id, l])), [allRows])

  const kind = emptyKind(period, Boolean(sheikhSlug || type))

  // يُشتقّ عند كل تصيير من `allRows` الطازجة، فيتحدّث مع كل قراءة جديدة للعرض
  const dialog = (() => {
    if (!dialogKey) return null
    if (dialogKey.kind === 'lecture') {
      const vm = byId.get(dialogKey.id)
      return vm ? { title: 'تفاصيل اللقاء', items: [vm] } : null
    }
    const items = allRows.filter((l) => l.dayKey === dialogKey.dayKey)
    if (items.length === 0) return null
    return { title: `${items[0].weekdayName} ${items[0].hijri}`, items }
  })()

  function openLecture(id: string) {
    if (byId.has(id)) setDialogKey({ kind: 'lecture', id })
  }

  function openDay(dayKey: string) {
    if (allRows.some((l) => l.dayKey === dayKey)) setDialogKey({ kind: 'day', dayKey })
  }

  return (
    <NowProvider serverNow={serverNow} boundaries={boundaries}>
      <Hero vm={hero} />

      <TopBar
        view={view}
        onView={setView}
        period={period}
        sheikhSlug={sheikhSlug}
        type={type}
        sheikhs={sheikhs}
        sheikhMode={sheikhMode}
      />

      <div className="wrap">
        <div className={publicLink ? 'sheikhbar on' : 'sheikhbar'}>
          {publicLink ? (
            <>
              <p>
                {publicLink.text} <code>{publicLink.path}</code>
              </p>
              {/*
                ⚠️ عنصر <button> عمداً لا <Link>. قاعدة النموذج `.sheikhbar button`
                معلّقة بالوسم لا بصنف (نصف قطر ٧px · حشوة 6/14 · وزن ٦٠٠)، ولو
                صُيِّر رابطاً بصنف `.backlink` لصار كبسولة ٩٩px بوزن ٧٠٠ — شكلٌ
                آخر، ولظهرت في صفحة السلسلة كبسولتان متطابقتان متتاليتان بدل
                كبسولة وزرّ. الشكل من النموذج، والتنقّل حقيقي.
              */}
              <button onClick={() => router.push(publicLink.backHref)}>عودة لكل اللقاءات</button>
            </>
          ) : null}
        </div>
      </div>

      <main className="wrap">
        {header}

        <section
          id="viewTable"
          role="tabpanel"
          aria-labelledby="tab-table"
          tabIndex={0}
          hidden={view !== 'table'}
        >
          <LectureTable
            rows={tableRows}
            emptyKind={kind}
            showSeriesColumns={showSeriesColumns}
          />
          <MobileCards rows={tableRows} emptyKind={kind} onOpen={openLecture} />
        </section>

        <section
          id="viewCal"
          role="tabpanel"
          aria-labelledby="tab-cal"
          tabIndex={0}
          hidden={view !== 'cal'}
        >
          <CalendarView
            rows={allRows}
            initialMonth={initialMonth}
            todayKey={todayKey}
            onOpenDay={openDay}
          />
        </section>
      </main>

      <LectureDialog
        title={dialog?.title ?? null}
        items={dialog?.items ?? []}
        onClose={() => setDialogKey(null)}
      />
    </NowProvider>
  )
}
