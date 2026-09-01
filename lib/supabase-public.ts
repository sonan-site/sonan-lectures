import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DbError } from './types'

/**
 * عميل القراءة العامة — بمفتاح `anon`.
 *
 * سياسات RLS تمنح هذا المفتاح القراءة وحدها ولا تمنحه كتابةً (القاعدة ٦.٥).
 * أي محاولة كتابة به تُرفض، وهذا مقصود لا خلل.
 *
 * ⚠️ يُنشأ **عند أول استعمال** لا عند تحميل الوحدة.
 *
 * السبب أن الإنشاء المبكّر يجعل غياب متغيّر بيئة يُسقط **البناء** نفسه:
 * `next build` يستورد وحدات المسارات وهو يجمع بيانات الصفحات، فتُرمى الرمية
 * قبل أن يُصيَّر شيء. والنتيجة أن نشراً على خادم لم تُضبط متغيّراته بعدُ
 * يفشل بخطأ ترجمة غامض بدل أن يُنشر ويعرض صفحة خطأ عربية مفهومة —
 * وهو ما يوجبه القسم ٧.
 *
 * فالتأجيل يجعل الإعداد الناقص خطأ **وقت طلب**، يلتقطه `app/error.tsx`
 * ويعرضه بالعربية، ويبقى البناء والنشر سليمين.
 */

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new DbError(
      'إعدادات المنصة غير مكتملة على الخادم. لم تُضبط بيانات الاتصال بقاعدة البيانات بعد.'
    )
  }

  client = createClient(url, anonKey, {
    auth: {
      // لا مستخدمين في هذا المشروع (ADR-0004) — لا جلسة تُحفظ ولا رمز يُجدَّد.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  return client
}

/** واجهة العميل نفسها، لكن إنشاؤه مؤجَّل إلى أول نداء */
export const supabasePublic: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient()
    const value = Reflect.get(c, prop) as unknown
    return typeof value === 'function' ? value.bind(c) : value
  },
})
