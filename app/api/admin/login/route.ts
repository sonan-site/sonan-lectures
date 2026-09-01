import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE_S,
  checkPassword,
  isAuthConfigured,
  issueSession,
  sessionCookieOptions,
} from '@/lib/server/auth'
import { blockedFor, clearFailures, clientKey, recordFailure } from '@/lib/server/rate-limit'

/**
 * تسجيل دخول المشرف.
 *
 * كلمة المرور تُرسَل مرة واحدة وتُقارَن على الخادم، ثم لا تعود. ما يُحفظ في
 * المتصفح كوكي `httpOnly` موقّع لا يحمل الكلمة ولا يشتقّ منها شيء يُقرأ.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const ar = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)])

function seconds(n: number): string {
  if (n === 1) return 'ثانية واحدة'
  if (n === 2) return 'ثانيتين'
  if (n <= 10) return `${ar(n)} ثوانٍ`
  return `${ar(n)} ثانية`
}

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: 'لوحة التحكم غير مهيّأة: كلمة المرور غير مضبوطة في إعدادات الخادم.' },
      { status: 503 }
    )
  }

  const key = clientKey(request.headers)

  const wait = blockedFor(key)
  if (wait > 0) {
    return NextResponse.json(
      { error: `محاولات كثيرة خاطئة. حاول بعد ${seconds(wait)}.` },
      { status: 429, headers: { 'retry-after': String(wait) } }
    )
  }

  let password: unknown
  try {
    const body = await request.json()
    password = (body as { password?: unknown })?.password
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
  }

  if (!checkPassword(password)) {
    const blocked = recordFailure(key)
    return NextResponse.json(
      {
        error: blocked
          ? `كلمة المرور غير صحيحة. تجاوزتَ عدد المحاولات — حاول بعد ${seconds(blocked)}.`
          : 'كلمة المرور غير صحيحة.',
      },
      { status: 401 }
    )
  }

  clearFailures(key)

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, issueSession(), sessionCookieOptions(SESSION_MAX_AGE_S))

  return NextResponse.json({ ok: true })
}
