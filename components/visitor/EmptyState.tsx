'use client'

/**
 * الحالات الفارغة — القسم ٧ يفرّق بين ثلاث، والنموذج لا يحمل إلا واحدة.
 *
 * رسالة النموذج الوحيدة تقترح «إزالة تصفية النوع»، فلو عُرضت حين لا تصفية
 * أصلاً لاقترحت على الزائر إزالة شيء لم يضعه. لذلك فُصلت الحالات.
 *
 * البنية والصنف `.empty` منقولان كما هما من النموذج، ولم يُضَف عنصر جديد:
 * النصّ يوجّه إلى مبدّل «القادمة/السابقة» الموجود في شريط التصفية فوقه.
 */

export type EmptyKind = 'filtered' | 'no-upcoming' | 'no-past'

const TEXT: Record<EmptyKind, { title: string; hint: string }> = {
  filtered: {
    title: 'لا لقاءات تطابق هذه التصفية',
    hint: 'جرّب اختيار شيخ آخر أو إزالة تصفية النوع.',
  },
  'no-upcoming': {
    title: 'لا لقاءات قادمة حالياً',
    hint: 'ما إن يُعلَن لقاء جديد حتى يظهر هنا. ولمعرفة ما مضى، اختر «السابقة» من الشريط أعلاه.',
  },
  'no-past': {
    title: 'لا لقاءات سابقة',
    hint: 'لم يُقَم لقاء بعد. اختر «القادمة» من الشريط أعلاه لرؤية المُعلَن منها.',
  },
}

export function EmptyState({ kind }: { kind: EmptyKind }) {
  const t = TEXT[kind]
  return (
    <div className="empty">
      <b>{t.title}</b>
      {t.hint}
    </div>
  )
}

/** أي حالة فارغة تُعرض، بحسب الوعاء وهل ثمّة تصفية فعّالة */
export function emptyKind(period: 'upcoming' | 'past', hasFilter: boolean): EmptyKind {
  if (hasFilter) return 'filtered'
  return period === 'upcoming' ? 'no-upcoming' : 'no-past'
}
