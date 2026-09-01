import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, sessionCookieOptions } from '@/lib/server/auth'

/**
 * خروج المشرف — يمحو الكوكي.
 *
 * `POST` لا `GET`: طلبُ صورةٍ أو استباقُ رابطٍ لا يجوز أن يُخرج المشرف،
 * ولأن الطلبات الآمنة لا تُحدث أثراً بحسب المعيار.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  const jar = await cookies()
  // بالخصائص نفسها التي أُصدر بها، وإلا بقي كوكي يتيم لا يُمحى
  jar.set(ADMIN_COOKIE, '', sessionCookieOptions(0))
  return NextResponse.json({ ok: true })
}
