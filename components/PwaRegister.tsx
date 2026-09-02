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
 *
 * كذلك يسم `<html>` بصنف `standalone` حين تعمل الصفحة مثبَّتةً فعلاً
 * (`display-mode: standalone`) لا مفتوحة في تبويب متصفّح عادي — بنية
 * تحتية لا تغيّر شيئاً ظاهراً بذاتها الآن، تُستعمل لاحقاً إن احتاج تصميم
 * ما تمييز الحالتين (خطة "إحساس التطبيق").
 */
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(display-mode: standalone)')
    const apply = () => document.documentElement.classList.toggle('standalone', mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return null
}
