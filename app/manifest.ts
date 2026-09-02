import type { MetadataRoute } from 'next'

/**
 * قالب PWA — يُقرأ عند تثبيت المنصة على الشاشة الرئيسية (أندرويد بصفة
 * أساسية؛ iOS لا يعتمد عليه، انظر `app/apple-icon.tsx`).
 *
 * الأيقونتان تُشيران إلى `app/icon/[size]/route.tsx`، فتُولَّدان من الشعار
 * المرفوع في `settings.logo_url` وقت الطلب — لا نسخة ثابتة تُنسى بعد
 * تغيير الشعار.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'اللقاءات العلمية · جمعية سنن',
    short_name: 'اللقاءات العلمية',
    description: 'جدول اللقاءات والدروس العلمية في جمعية سنن التعليمية.',
    start_url: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#fcfaf7',
    theme_color: '#2a3f46',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
