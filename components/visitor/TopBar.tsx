'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { LectureType, Period } from '@/lib/types'
import type { SheikhOptionVM } from '@/lib/view-model'

/**
 * شريط التبويبين والتصفية — منقول من `<nav class="bar">` في النموذج المعتمد.
 *
 * التصفية في معاملات الرابط لا في حالة العميل، لسببين:
 *   ١. الرابط يصير قابلاً للمشاركة وزرّ الرجوع يعمل — والمشروع كلّه مبنيّ
 *      على ثقافة الروابط العامة.
 *   ٢. والأهم: الوعاء «قادم/سابق» يعتمد على الحالة الآتية من `v_lectures`
 *      وعلى اللحظة الراهنة. لو رُشِّح في المتصفح على حمولة جُلبت قبل نصف ساعة،
 *      لبقي لقاءٌ انتهى ظاهراً في «القادمة» بينما يعرضه التقويم منتهياً —
 *      وهو بعينه تعارض «الجدول ضدّ التقويم» في القاعدة ٦.١.
 *
 * أما التبويب فحالة عميل: النموذج يصيّر القسمين معاً ويبدّل بينهما بـ`hidden`،
 * فالتبديل فوري بلا جولة إلى الخادم. نُبقيه كما هو.
 *
 * ⚠️ المعرّفان `fSheikh` و`fType` ليسا زينة: قاعدة
 * `@media(max-width:640px){#fSheikh,#fType{flex:1 1 calc(50% - 4px)}}`
 * معلّقة بهما وتفترض **عنصرين**. حذف أحدهما يجعل الآخر يمتدّ إلى عرض الصفّ
 * كاملاً بدل النصف، فتنكسر هيئة الشريط على الجوال. لذلك تبقى القائمتان في
 * كل الصفحات، وما يتغيّر هو ما تفعله قائمة المشايخ:
 *   `filter`   في `/`             — تضبط معامل التصفية
 *   `navigate` في الصفحات الفرعية — تنتقل إلى صفحة الشيخ، كما في النموذج
 *                                    الذي يفتح صفحة الشيخ عند اختياره
 */

export type View = 'table' | 'cal'

const TYPE_OPTIONS: { value: LectureType; label: string }[] = [
  { value: 'onsite', label: 'حضوري' },
  { value: 'remote', label: 'عن بُعد' },
  { value: 'hybrid', label: 'حضوري وعن بُعد' },
]

export function TopBar({
  view,
  onView,
  period,
  sheikhSlug,
  type,
  sheikhs,
  sheikhMode = 'filter',
}: {
  view: View
  onView: (v: View) => void
  period: Period
  sheikhSlug: string
  type: string
  sheikhs: SheikhOptionVM[]
  sheikhMode?: 'filter' | 'navigate'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  /**
   * القائمتان عنصران متحكَّم بهما قيمتهما من الخصائص. وتحديث الرابط يقع داخل
   * `startTransition`، فتبقى الخصائص القديمة طوال جولة الخادم وتُرجع React
   * العنصر إلى ما قبل الاختيار — فيرى الزائر اختياره يُلغى أمامه ثم يعود.
   * فنحتفظ بالقيمة محلّياً ونزامنها متى لحقت الخصائص.
   */
  const [localSheikh, setLocalSheikh] = useState(sheikhSlug)
  const [localType, setLocalType] = useState(type)
  useEffect(() => setLocalSheikh(sheikhSlug), [sheikhSlug])
  useEffect(() => setLocalType(type), [type])

  /** يبني الرابط من القيم الحالية، ويحذف الافتراضي منه فيبقى `/` نظيفاً */
  function apply(next: { period?: Period; sheikh?: string; type?: string }) {
    const p = new URLSearchParams()
    const nextPeriod = next.period ?? period
    const nextSheikh = next.sheikh ?? localSheikh
    const nextType = next.type ?? localType

    if (nextPeriod !== 'upcoming') p.set('period', nextPeriod)
    if (nextSheikh && sheikhMode === 'filter') p.set('sheikh', nextSheikh)
    if (nextType) p.set('type', nextType)

    const qs = p.toString()
    startTransition(() => {
      // replace لا push: الرابط يبقى قابلاً للمشاركة بلا تلويث سجلّ التصفّح
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  function onSheikhChange(value: string) {
    setLocalSheikh(value)
    if (sheikhMode === 'navigate') {
      // تنقّل حقيقي: صفحة الشيخ مسار مستقلّ يُرسَل إليه
      startTransition(() => router.push(value ? `/sheikh/${value}` : '/'))
    } else {
      apply({ sheikh: value })
    }
  }

  return (
    <nav className="bar">
      <div className="wrap">
        {/* أسهم لوحة المفاتيح تنقل بين التبويبين — والاتجاه معكوس في RTL:
            السهم الأيسر يعني «التالي». يكمل نمط ARIA بلا أي أثر بصري. */}
        <div
          className="tabs"
          role="tablist"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            e.preventDefault()
            const next = e.key === 'ArrowLeft' ? 'cal' : 'table'
            onView(next as View)
            document.getElementById(next === 'cal' ? 'tab-cal' : 'tab-table')?.focus()
          }}
        >
          <button
            id="tab-table"
            className="tab"
            role="tab"
            aria-selected={view === 'table'}
            aria-controls="viewTable"
            onClick={() => onView('table')}
          >
            الجدول
          </button>
          <button
            id="tab-cal"
            className="tab"
            role="tab"
            aria-selected={view === 'cal'}
            aria-controls="viewCal"
            onClick={() => onView('cal')}
          >
            التقويم
          </button>
        </div>

        <div
          className="filters"
          id="filters"
          aria-busy={isPending}
          style={{ visibility: view === 'cal' ? 'hidden' : 'visible' }}
        >
          <div className="seg">
            <button
              data-when="up"
              aria-pressed={period === 'upcoming'}
              onClick={() => apply({ period: 'upcoming' })}
            >
              القادمة
            </button>
            <button
              data-when="past"
              aria-pressed={period === 'past'}
              onClick={() => apply({ period: 'past' })}
            >
              السابقة
            </button>
          </div>

          <select
            id="fSheikh"
            aria-label="تصفية بالشيخ"
            value={localSheikh}
            onChange={(e) => onSheikhChange(e.target.value)}
          >
            <option value="">كل المشايخ</option>
            {sheikhs.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            id="fType"
            aria-label="تصفية بنوع اللقاء"
            value={localType}
            onChange={(e) => {
              setLocalType(e.target.value)
              apply({ type: e.target.value })
            }}
          >
            <option value="">كل الأنواع</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  )
}
