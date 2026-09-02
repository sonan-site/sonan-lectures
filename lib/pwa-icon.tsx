import { ImageResponse } from 'next/og'
import { getSettings } from './queries'

/**
 * توليد أيقونة PWA مربّعة من الشعار المرفوع — تستعمله كل من
 * `app/icon/[size]/route.tsx` (لِـ`manifest.webmanifest`) و
 * `app/apple-icon.tsx` (لِـ`apple-touch-icon` الذي يتطلّبه iOS رابطاً
 * ثابتاً في الـHTML، لا عنصراً من الـmanifest — القسم الفني في الإحاطة).
 */
export async function renderPwaIcon(size: number): Promise<ImageResponse> {
  const settings = await getSettings().catch(() => null)
  const logoUrl = settings?.logo_url ?? null
  const pad = Math.round(size * 0.12)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fcfaf7',
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            width={size - pad * 2}
            height={size - pad * 2}
            style={{ objectFit: 'contain' }}
            alt=""
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#2a3f46',
              color: '#fcfaf7',
              fontSize: size * 0.52,
              fontWeight: 800,
            }}
          >
            س
          </div>
        )}
      </div>
    ),
    {
      width: size,
      height: size,
      // next/og يضع افتراضياً تخزيناً دائماً (سنة كاملة) — مناسب لأيقونة
      // ثابتة، لكنه هنا يُجمّد الأيقونة القديمة لدى الزائرين بعد أي تغيير
      // للشعار. ساعة واحدة تكفي لتحديث معقول بلا إغراق Supabase بطلبات.
      headers: { 'cache-control': 'public, max-age=3600, must-revalidate' },
    }
  )
}
