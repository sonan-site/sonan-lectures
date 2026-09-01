import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * عميل الكتابة — بمفتاح `service_role`.
 *
 * القاعدة ٦.٤: هذا المفتاح لا يغادر الخادم.
 *   · يُستعمل حصراً داخل `app/api/**` أو `lib/server/**`
 *   · لا يُستورد في أي ملف فيه 'use client'
 *   · لا يحمل بادئة NEXT_PUBLIC_
 *
 * سطر `import 'server-only'` أعلاه ليس تعليقاً بل حارس بناء: أي محاولة
 * لاستيراد هذا الملف من مكوّن عميل تُفشل البناء برسالة صريحة، فلا يتسرّب
 * المفتاح إلى حزمة المتصفح ولو سهواً.
 *
 * والإنشاء مؤجَّل إلى أول استعمال للسبب نفسه في `supabase-public.ts`:
 * إعدادٌ ناقص يجب أن يُنتج خطأ وقت طلب برسالة عربية، لا أن يُسقط البناء.
 *
 * القاعدة ٦.٥: كل كتابة تمرّ من هنا، بعد أن يفحص Route Handler كوكي المشرف.
 */

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'إعدادات الخادم ناقصة: تأكّد من NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في متغيّرات البيئة.'
    )
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient()
    const value = Reflect.get(c, prop) as unknown
    return typeof value === 'function' ? value.bind(c) : value
  },
})
