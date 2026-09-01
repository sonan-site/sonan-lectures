import { NextResponse } from 'next/server'
import { supabasePublic } from '@/lib/supabase-public'
import { buildIcs } from '@/lib/ics'
import type { LectureView } from '@/lib/types'

/**
 * تنزيل ملف تقويم للقاء واحد — `/api/ics/<id>`
 *
 * قراءة فقط بمفتاح `anon`: لا كتابة ولا مفتاح خدمة، فلا يخالف القاعدتين ٦.٤ و٦.٥.
 * ويقرأ من `v_lectures` فتأتي الوراثة والحالة محسومتين من قاعدة البيانات.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // يمنع تمرير نصّ عشوائي إلى الاستعلام، ويعطي ٤٠٤ سريعاً بلا جولة قاعدة بيانات
  if (!UUID.test(id)) {
    return new NextResponse('معرّف اللقاء غير صالح', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const { data, error } = await supabasePublic
    .from('v_lectures')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return new NextResponse('تعذّر الوصول إلى بيانات اللقاء', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  if (!data) {
    return new NextResponse('لا يوجد لقاء بهذا المعرّف', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const body = buildIcs(data as LectureView)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      // اسم الملف ASCII خالص — بعض العملاء يفسد ترميز العربية في الترويسة
      'content-disposition': `attachment; filename="sonan-${id.slice(0, 8)}.ics"`,
      'cache-control': 'no-store, must-revalidate',
    },
  })
}
