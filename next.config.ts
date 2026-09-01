import type { NextConfig } from 'next'

/**
 * مضيف مخزن Supabase — منه يأتي الشعار المرفوع من لوحة التحكم.
 * نستخرجه من متغيّر البيئة ولا نكتبه يدوياً.
 *
 * ولا ندع خطأً في المتغيّر يُسقط البناء برسالة غامضة:
 * إن كانت القيمة ليست رابطاً صالحاً، نُصدر تحذيراً عربياً مفهوماً ونمضي —
 * فالصفحات تعمل بلا شعار، والخلل يظهر في `npm run check:db` بوضوح.
 */
function storageHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return null
  try {
    return new URL(raw).hostname
  } catch {
    console.warn(
      `\n⚠️  NEXT_PUBLIC_SUPABASE_URL ليست رابطاً صالحاً: «${raw}»\n` +
        `   المتوقّع رابط كامل مثل: https://${raw}.supabase.co\n` +
        `   صحّحه في ‎.env.local — الشعار لن يُعرض حتى ذلك.\n`
    )
    return null
  }
}

const host = storageHost()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: host
      ? [{ protocol: 'https', hostname: host, pathname: '/storage/v1/object/public/**' }]
      : [],
  },
}

export default nextConfig
