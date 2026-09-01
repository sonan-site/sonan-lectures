import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { fail, requireAdmin } from '@/lib/server/admin-guard'

/**
 * رفع شعار الجمعية وإزالته.
 *
 * القاعدة ٦.٥: لا كتابة من المتصفح. المخزن `branding` بلا سياسة كتابة،
 * والرفع بمفتاح الخدمة الذي يتجاوز RLS — **فحارس المشرف هو الضابط الوحيد**،
 * ولا شبكة أمان تحته. لذلك هو أول سطرين في كل معالج هنا.
 *
 * ونوع الملف يُستنتج من بايتاته لا من ترويسة المتصفح: الترويسة يكتبها
 * العميل، وSupabase Storage يعيد بثّ ما خُزِّن منها — فلو مُرِّرت كما جاءت
 * لأمكن تخزين ملف بـ`text/html` على مخزن عام، وذلك نصّ يُنفَّذ عند فتح رابطه.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_BYTES = 2 * 1024 * 1024
const MAX_SIDE = 4000
const PUBLIC_MARKER = '/storage/v1/object/public/branding/'

type Mime = 'image/png' | 'image/jpeg' | 'image/webp'

const EXT: Record<Mime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/**
 * استنتاج النوع من الأرقام السحرية.
 *
 * ⚠️ SVG لا بصمة له — نصّ خالص قد يبدأ بفراغ أو تعليق أو ترويسة XML، فلا
 * سبيل للتأكّد أنه SVG لا HTML. وهذا وحده يمنع قبوله: ما لا يُتحقّق منه
 * لا يُخزَّن على مخزن عام يُفتح رابطه مباشرةً.
 */
function sniff(b: Uint8Array): Mime | null {
  const at = (o: number, sig: number[]) => sig.every((v, i) => b[o + i] === v)

  if (b.length > 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (
    b.length > 4 &&
    at(0, [0xff, 0xd8, 0xff]) &&
    b[b.length - 2] === 0xff &&
    b[b.length - 1] === 0xd9
  ) {
    return 'image/jpeg'
  }
  if (
    b.length > 12 &&
    at(0, [0x52, 0x49, 0x46, 0x46]) && // RIFF
    at(8, [0x57, 0x45, 0x42, 0x50]) // WEBP
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * أبعاد الصورة من ترويستها — حدّ ٢ ميجابايت يقيّد البايتات لا البكسلات.
 * ملف PNG بأربعين كيلوبايت قد يفكّ إلى عشرات الجيجابايت في ذاكرة الزائر.
 */
function dimensions(b: Uint8Array, mime: Mime): { w: number; h: number } | null {
  try {
    if (mime === 'image/png') {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
      return { w: dv.getUint32(16), h: dv.getUint32(20) }
    }
    if (mime === 'image/webp' && String.fromCharCode(...b.slice(12, 16)) === 'VP8X') {
      return {
        w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
        h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
      }
    }
  } catch {
    return null
  }
  return null
}

/** يمنع إرسال النموذج من موقع آخر — طبقة ثانية فوق SameSite=Lax */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return false
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false
    } catch {
      return false
    }
  }
  return true
}

/** يحذف الكائن القديم من المخزن — فشله يُسجَّل ولا يُفشل الطلب */
async function removeOld(previousUrl: string | null): Promise<void> {
  if (!previousUrl || !previousUrl.includes(PUBLIC_MARKER)) return
  const key = decodeURIComponent(previousUrl.split(PUBLIC_MARKER)[1]?.split('?')[0] ?? '')
  if (!key || key.includes('/') || key.includes('..')) return
  const { error } = await supabaseAdmin.storage.from('branding').remove([key])
  if (error) console.error('[logo] تعذّر حذف الشعار القديم:', error.message)
}

async function currentLogo(): Promise<string | null> {
  const { data } = await supabaseAdmin.from('settings').select('logo_url').eq('id', true).single()
  return data?.logo_url ?? null
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  if (!sameOrigin(request)) return fail('طلب من مصدر غير موثوق.', 403)

  // قبل قراءة الجسم: الترويسة تمنع ابتلاع ملف ضخم في الذاكرة
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES + 4096) {
    return fail('حجم الملف يتجاوز ٢ ميجابايت.', 413)
  }

  let file: File
  try {
    const form = await request.formData()
    const value = form.get('logo')
    if (!(value instanceof File)) return fail('لم يصل أي ملف.', 400)
    file = value
  } catch {
    return fail('تعذّر قراءة الملف المُرسَل.', 400)
  }

  if (file.size === 0) return fail('الملف فارغ.', 400)
  if (file.size > MAX_BYTES) return fail('حجم الملف يتجاوز ٢ ميجابايت.', 413)

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) return fail('حجم الملف يتجاوز ٢ ميجابايت.', 413)

  const mime = sniff(bytes)
  if (!mime) {
    return fail(
      'الملف يجب أن يكون صورة PNG أو JPEG أو WebP. ملفات SVG غير مقبولة للشعار.',
      415
    )
  }

  const dim = dimensions(bytes, mime)
  if (dim && (dim.w > MAX_SIDE || dim.h > MAX_SIDE)) {
    return fail('أبعاد الصورة أكبر من اللازم. العرض المناسب ٣٠٠–٦٠٠ بكسل.', 422)
  }

  // اسم فريد لكل رفع: اسم الملف من المستخدم لا يدخل المسار إطلاقاً،
  // والعنوان الجديد يُسقط مسألة الذاكرة المؤقّتة من أصلها
  const key = `logo-${randomUUID()}.${EXT[mime]}`
  const previous = await currentLogo()

  const { error: upErr } = await supabaseAdmin.storage
    .from('branding')
    .upload(key, bytes, { contentType: mime, upsert: false, cacheControl: '60' })

  if (upErr) return fail('تعذّر رفع الشعار. حاول مرة أخرى.', 503)

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('branding').getPublicUrl(key)

  const { error: dbErr } = await supabaseAdmin
    .from('settings')
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', true)

  if (dbErr) {
    // لا نترك كائناً يتيماً لا يشير إليه شيء
    await supabaseAdmin.storage.from('branding').remove([key])
    return fail('رُفع الملف ثم تعذّر حفظه في الإعدادات، فأُلغي الرفع.', 503)
  }

  await removeOld(previous)

  return NextResponse.json({ ok: true, logo_url: publicUrl })
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  if (!sameOrigin(request)) return fail('طلب من مصدر غير موثوق.', 403)

  const previous = await currentLogo()

  const { error } = await supabaseAdmin
    .from('settings')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('id', true)

  if (error) return fail('تعذّر إزالة الشعار. حاول مرة أخرى.', 503)

  // يُحذف الملف أيضاً لا العمود وحده: تركه يُبقيه مفتوحاً للعالم بعنوانه
  // بعد أن يظنّه المشرف محذوفاً.
  await removeOld(previous)

  return NextResponse.json({ ok: true })
}
