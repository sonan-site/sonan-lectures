'use client'

import { useEffect } from 'react'

/**
 * يسجّل `public/sw.js` بعد اكتمال التحميل — شرط أندرويد/كروم لعرض
 * اقتراح «إضافة إلى الشاشة الرئيسية». iOS (Safari) يتجاهل عامل الخدمة
 * كلياً ولا يحتاجه؛ اعتماده هناك على `apple-touch-icon` وحده
 * (`app/apple-icon.tsx`).
 *
 * فشل التسجيل — متصفح لا يدعمه، أو غير آمن (HTTP لا HTTPS) — يُمرَّر
 * صامتاً: PWA تحسين اختياري، لا وظيفة أساسية تستحق رسالة خطأ للزائر.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}
