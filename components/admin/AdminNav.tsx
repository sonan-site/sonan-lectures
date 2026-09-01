'use client'

/**
 * شريط تبويبات اللوحة — منقول من `navHTML()` في `prototype/admin.html`.
 *
 * يُصيَّر مرّتين بالمحتوى نفسه: شريطاً علوياً `.nav` على الشاشة الواسعة،
 * وشريطاً سفلياً ثابتاً `.bnav` دون ٨٢٠ بكسل. والورقة هي التي تُظهر أحدهما
 * وتُخفي الآخر — لا قياسَ عرضٍ في JavaScript، فلا وميض ولا اختلاف بين
 * ما يُصيَّر في الخادم وما يراه المتصفح.
 *
 * مسارات الأيقونات منسوخة حرفياً من النموذج.
 */

export type AdminTab = 'lec' | 'ser' | 'shk' | 'set'

const ICONS: Record<AdminTab, React.ReactNode> = {
  lec: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  ser: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  shk: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  set: (
    <>
      <path d="M4 7h9M18 7h2M4 17h5M13 17h7" />
      <circle cx="15.5" cy="7" r="2" />
      <circle cx="11" cy="17" r="2" />
    </>
  ),
}

export const ADMIN_TABS: { key: AdminTab; label: string }[] = [
  { key: 'lec', label: 'اللقاءات' },
  { key: 'ser', label: 'السلاسل' },
  { key: 'shk', label: 'المشايخ' },
  { key: 'set', label: 'الإعدادات' },
]

function Buttons({
  active,
  onSelect,
  idPrefix,
}: {
  active: AdminTab
  onSelect: (t: AdminTab) => void
  idPrefix: string
}) {
  return (
    <>
      {ADMIN_TABS.map((t) => (
        <button
          key={t.key}
          id={`${idPrefix}-${t.key}`}
          role="tab"
          aria-selected={t.key === active}
          aria-controls={`panel-${t.key}`}
          onClick={() => onSelect(t.key)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {ICONS[t.key]}
          </svg>
          {t.label}
        </button>
      ))}
    </>
  )
}

export function AdminNav({
  active,
  onSelect,
}: {
  active: AdminTab
  onSelect: (t: AdminTab) => void
}) {
  return (
    <nav className="nav" role="tablist" aria-label="أقسام لوحة التحكم">
      <div className="wrap">
        <Buttons active={active} onSelect={onSelect} idPrefix="tabtop" />
      </div>
    </nav>
  )
}

export function AdminBottomNav({
  active,
  onSelect,
}: {
  active: AdminTab
  onSelect: (t: AdminTab) => void
}) {
  return (
    <nav className="bnav" role="tablist" aria-label="أقسام لوحة التحكم">
      <Buttons active={active} onSelect={onSelect} idPrefix="tabbot" />
    </nav>
  )
}
