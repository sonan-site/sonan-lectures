import { getAdminData } from '@/lib/admin-queries'
import { AdminWorkspace } from '@/components/admin/AdminWorkspace'

/**
 * لوحة التحكم — أربعة تبويبات (القسم ٥).
 *
 * القاعدة ٦.٢: لا تخزين مؤقّت. اللوحة تقرأ الحالة من `v_lectures` كما يقرؤها
 * الزائر، فأي تخزين يجعل المشرف يرى حالةً غير التي يراها الناس.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminHome() {
  const data = await getAdminData()
  return <AdminWorkspace data={data} serverNow={Date.now()} />
}
