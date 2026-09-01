'use client'

import type { LectureVM } from '@/lib/view-model'

/**
 * لبنات الخلايا المشتركة بين الجدول والنافذة — منقولة من دوالّ النموذج
 * `whenHTML` و`destHTML` وشارة النوع.
 *
 * ⚠️ المسافات داخل JSX: كل تعبير ومسافته على سطر واحد. كسر السطر بين
 * `{a}` و`{b}` يحذف المسافة بينهما فتلتصق الكلمات — «الاثنين١٨ ربيع الأول».
 * لا تدع منسّقاً تلقائياً يكسر هذه الأسطر.
 */

/** عمود «الموعد»: عمود واحد يجمع التاريخ الهجري واليوم والوقت والمدة */
export function When({ vm }: { vm: LectureVM }) {
  return (
    <span className="when">
      <b>{vm.hijri}</b>
      <u>
        {vm.weekdayName} · {vm.time} · {vm.durationAr} د
      </u>
    </span>
  )
}

/** شارة النوع، أو وسم «ملغى» حين يُلغى اللقاء */
export function TypeChip({ vm }: { vm: LectureVM }) {
  if (vm.isCancelled) return <span className="chip no">{vm.cancelledChip}</span>
  return <span className={`chip ${vm.typeClass}`}>{vm.typeLabel}</span>
}

/**
 * عمود «الوجهة» — تفريعي بحسب النوع:
 *   حضوري   ← 📍 المكان ورابط خرائطه
 *   عن بُعد ← 🔗 اضغط هنا للدخول
 *   كلاهما  ← الاثنان معاً
 */
export function Destination({ vm }: { vm: LectureVM }) {
  const parts: React.ReactNode[] = []

  if (vm.type !== 'remote') {
    parts.push(
      vm.mapUrl ? (
        <a key="map" className="go map" href={vm.mapUrl} target="_blank" rel="noopener noreferrer">
          📍 {vm.place}
        </a>
      ) : (
        // لا رابط خرائط في الإعدادات — يُعرض المكان نصّاً بالمظهر نفسه
        <span key="map" className="go map">
          📍 {vm.place}
        </span>
      )
    )
  }

  if (vm.type !== 'onsite' && vm.joinUrl) {
    parts.push(
      <a key="join" className="go join" href={vm.joinUrl} target="_blank" rel="noopener noreferrer">
        🔗 اضغط هنا للدخول
      </a>
    )
  }

  // احتياط: القاعدة ٦.٨ تمنع نشوء «عن بُعد بلا رابط» من جهة الخادم،
  // لكن صفّاً قديماً مخالفاً يجب ألّا يترك الخانة فارغة بلا معنى.
  if (parts.length === 0) return <span className="state">—</span>

  return <div className="dest">{parts}</div>
}
