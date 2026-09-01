import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * حراسة لوحة التحكم — كلمة مرور واحدة على الخادم (ADR-0004).
 *
 * لا مستخدمين في Supabase Auth: المحرّر واحد والمحتوى معلَن أصلاً. وهذا
 * قرارٌ سابقٌ للبناء، لا تجاوزٌ للأصول — لكنه ينقل إلينا ما كانت الخدمة
 * الجاهزة تتكفّل به. فهذه الوحدة تتولّاه صراحةً:
 *
 *   · كلمة المرور لا تغادر الخادم ولا تدخل الكوكي ولا تُسجَّل في أي مخرج.
 *   · المقارنة بزمن ثابت على بصمة موحّدة الطول — فلا يُستدلّ على الكلمة
 *     من فروق زمن الاستجابة ولا من طولها.
 *   · الكوكي موقّع بـHMAC-SHA256، ومفتاح التوقيع **مشتقّ من كلمة المرور**:
 *     فتغييرها في Vercel يُبطل كل الجلسات القائمة فوراً — وهو ما يوجبه
 *     ADR-0004 لإبطال الوصول عند تسرّبها.
 *   · الحمولة الموقّعة تاريخُ انتهاءٍ فحسب. لا اسم ولا صلاحية ولا سرّ.
 *
 * `import 'server-only'` أعلاه حارس بناء: أي استيراد من مكوّن عميل يُفشل
 * البناء، فلا تتسرّب كلمة المرور إلى حزمة المتصفح ولو سهواً.
 */

export const ADMIN_COOKIE = 'sonan_admin'

/** ثلاثون يوماً — مدّة الجلسة في ADR-0004 */
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60

function adminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw || pw.trim().length < 8) {
    throw new Error(
      'ADMIN_PASSWORD ناقصة أو أقصر من ثمانية محارف — لوحة التحكم معطّلة حتى تُضبط في ‎.env.local'
    )
  }
  return pw
}

/** هل المتغيّر مضبوط أصلاً — للفحص بلا رمي استثناء */
export function isAuthConfigured(): boolean {
  const pw = process.env.ADMIN_PASSWORD
  return Boolean(pw && pw.trim().length >= 8)
}

/**
 * مقارنة بزمن ثابت.
 *
 * لا تُقارَن النصوص مباشرةً: `===` يخرج عند أول محرف مختلف، فيُفشي زمنُ
 * الاستجابة كم محرفاً صحّ من أوّلها. وبصمة SHA-256 لكلا الطرفين توحّد
 * الطول أيضاً، فلا يُفشى طول الكلمة من طول المعالجة.
 */
export function checkPassword(input: unknown): boolean {
  if (typeof input !== 'string' || input.length === 0 || input.length > 512) return false

  let expected: string
  try {
    expected = adminPassword()
  } catch {
    return false
  }

  const a = createHmac('sha256', 'sonan-password-compare').update(input).digest()
  const b = createHmac('sha256', 'sonan-password-compare').update(expected).digest()
  return timingSafeEqual(a, b)
}

function sign(payload: string): string {
  return createHmac('sha256', adminPassword()).update(payload).digest('base64url')
}

/** يُصدر رمز جلسة: `تاريخ_الانتهاء.التوقيع` */
export function issueSession(now: number = Date.now()): string {
  const exp = String(Math.floor(now / 1000) + SESSION_MAX_AGE_S)
  return `${exp}.${sign(exp)}`
}

/** يتحقّق من رمز الجلسة: التوقيع سليم ولم ينتهِ أجله */
export function verifySession(token: string | undefined | null, now: number = Date.now()): boolean {
  if (!token || token.length > 256) return false

  const dot = token.indexOf('.')
  if (dot <= 0) return false

  const exp = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  // تاريخ الانتهاء رقم صحيح موجب فقط — يمنع تمرير نصّ عشوائي إلى HMAC
  if (!/^\d{1,12}$/.test(exp)) return false
  if (Number(exp) * 1000 <= now) return false

  let expected: string
  try {
    expected = sign(exp)
  } catch {
    return false
  }

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** خصائص الكوكي — موحّدة بين الإصدار والحذف حتى لا يتخلّف كوكي يتيم */
export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE_S) {
  return {
    httpOnly: true, // لا يُقرأ بـJavaScript، فلا يُسرَق بحقن نصّي
    secure: process.env.NODE_ENV === 'production', // لا يُرسَل إلا عبر HTTPS
    sameSite: 'lax' as const, // يمنع إرساله مع طلبات مواقع أخرى
    path: '/',
    maxAge,
  }
}
