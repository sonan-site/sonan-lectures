import 'server-only'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifySession } from './auth'

/**
 * حارس معالجات الكتابة.
 *
 * القاعدة ٦.٥: «كل كتابة تمرّ عبر الخادم». وحراسة التخطيط تحمي **العرض**
 * وحده — من يعرف عنوان المعالج يستطيع مناداته مباشرةً بلا أن يمرّ بصفحة.
 * فكل معالج يكتب يفحص الكوكي بنفسه قبل أن يلمس مفتاح الخدمة.
 *
 * يعيد `null` إن كانت الجلسة سارية، وإلا يعيد استجابة الرفض جاهزة.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const jar = await cookies()
  if (verifySession(jar.get(ADMIN_COOKIE)?.value)) return null

  return NextResponse.json(
    { error: 'انتهت جلستك أو لم تسجّل الدخول. أعد تسجيل الدخول ثم حاول مرة أخرى.' },
    { status: 401 }
  )
}

/** استجابة خطأ عربية موحّدة */
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}
