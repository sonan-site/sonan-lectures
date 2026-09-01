'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminData } from '@/lib/admin-queries'
import { AdminBottomNav, AdminNav, type AdminTab } from './AdminNav'
import { AdminDialog } from './AdminDialog'
import { Toast } from './Toast'
import { LecturesTab } from './LecturesTab'
import { SeriesTab } from './SeriesTab'
import { EditLectureForm } from './EditLectureForm'
import { NewSeriesForm } from './NewSeriesForm'
import { SheikhsTab } from './SheikhsTab'
import { NewSheikhForm } from './NewSheikhForm'
import { SettingsTab } from './SettingsTab'

/**
 * غلاف اللوحة — يحمل التبويب النشط والنوافذ والإشعار.
 *
 * كل بيانات اللوحة تصل جاهزة من الخادم، وبعد كل كتابة ناجحة يُطلب
 * `router.refresh()` فتُقرأ من جديد — فلا نسخة محلّية تتباعد عن قاعدة
 * البيانات، ولا حالة تُحسب في المتصفح.
 *
 * التبويبات الأربعة كاملة.
 */
export function AdminWorkspace({ data, serverNow }: { data: AdminData; serverNow: number }) {
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>('lec')
  const [editId, setEditId] = useState<string | null>(null)
  const [newSeries, setNewSeries] = useState(false)
  const [newSheikh, setNewSheikh] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const editing = editId ? (data.lectures.find((l) => l.id === editId) ?? null) : null

  const done = useCallback(
    (message: string) => {
      setEditId(null)
      setNewSeries(false)
      setNewSheikh(false)
      setToast(message)
      router.refresh()
    },
    [router]
  )

  const panels: Record<AdminTab, React.ReactNode> = {
    lec: (
      <LecturesTab
        lectures={data.lectures}
        series={data.series}
        serverNow={serverNow}
        onEdit={setEditId}
        onNewSeries={() => setNewSeries(true)}
      />
    ),
    ser: (
      <SeriesTab
        series={data.series}
        onNewSeries={() => setNewSeries(true)}
        onCopied={setToast}
      />
    ),
    shk: (
      <SheikhsTab
        sheikhs={data.allSheikhs}
        onDone={done}
        onNewSheikh={() => setNewSheikh(true)}
      />
    ),
    set: (
      <SettingsTab
        logoUrl={data.logoUrl}
        hqPlace={data.hqPlace}
        hqMapUrl={data.hqMapUrl}
        defaultDuration={90}
        onDone={done}
      />
    ),
  }

  return (
    <>
      <AdminNav active={tab} onSelect={setTab} />

      <main className="wrap">
        {(Object.keys(panels) as AdminTab[]).map((k) => (
          <section
            key={k}
            id={`panel-${k}`}
            role="tabpanel"
            aria-labelledby={`tabtop-${k}`}
            tabIndex={0}
            hidden={tab !== k}
          >
            {panels[k]}
          </section>
        ))}
      </main>

      <AdminBottomNav active={tab} onSelect={setTab} />

      <AdminDialog
        title={editing ? `تعديل اللقاء ${editing.ordAr} — ${editing.seriesTitle}` : ''}
        open={Boolean(editing)}
        onClose={() => setEditId(null)}
      >
        {editing ? (
          <EditLectureForm vm={editing} onSaved={done} onCancel={() => setEditId(null)} />
        ) : null}
      </AdminDialog>

      <AdminDialog title="شيخ جديد" open={newSheikh} onClose={() => setNewSheikh(false)}>
        <NewSheikhForm
          takenSlugs={data.allSheikhs.map((s) => s.slug)}
          onCreated={done}
          onCancel={() => setNewSheikh(false)}
        />
      </AdminDialog>

      <AdminDialog title="سلسلة جديدة" open={newSeries} onClose={() => setNewSeries(false)}>
        <NewSeriesForm
          sheikhs={data.sheikhs}
          takenSlugs={data.series.map((s) => s.slug)}
          hqPlace={data.hqPlace}
          hqMapUrl={data.hqMapUrl}
          onCreated={done}
          onCancel={() => setNewSeries(false)}
        />
      </AdminDialog>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  )
}

