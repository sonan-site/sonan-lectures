import type { LectureView } from './types'

/**
 * توليد ملف تقويم `.ics` للقاء واحد — زرّ «أضف إلى تقويمي» 🗓
 *
 * بديل التنبيهات الآلية بواتساب أو البريد، وهي خارج النطاق صراحةً
 * (القسم ١٠ · و«خارج النطاق» في حصيلة القرارات).
 *
 * الوحدة خالصة: تبني نصّاً ولا تلمس المتصفح ولا الخادم،
 * فتصلح للتنزيل من العميل أو للتقديم من Route Handler.
 *
 * ملاحظة على النموذج: نموذج `prototype/index.html` يبني الملف بلا تهريب
 * للفواصل والأسطر. عنوانٌ فيه فاصلة — «شرح بلوغ المرام، كتاب الطهارة» —
 * يكسر الملف عند التطبيقات المتشدّدة. هذا تصحيح صحّة لا تغيير تصميم:
 * الشكل والسلوك كما هما، والمخرج صار مطابقاً لـ RFC 5545.
 */

/** تهريب القيم النصّية: الشرطة المائلة والفاصلة المنقوطة والفاصلة والسطر الجديد */
function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * طيّ الأسطر عند ٧٥ ثُماني بايت — يقيس بالبايت لا بالمحرف،
 * لأن الحرف العربي في UTF-8 بايتان، فالقياس بالطول يكسر الحدّ.
 */
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line

  const out: string[] = []
  let current = ''
  let bytes = 0

  for (const ch of line) {
    const size = enc.encode(ch).length
    // السطر التالي يبدأ بمسافة، فحدّه ٧٤ لا ٧٥
    const limit = out.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  if (current) out.push(current)

  return out.map((seg, i) => (i === 0 ? seg : ` ${seg}`)).join('\r\n')
}

/** 20260831T104200Z — لحظة مطلقة بتوقيت UTC كما يوجب المعيار */
function stamp(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/** اسم الملف المقترح عند التنزيل */
export function icsFileName(lecture: LectureView): string {
  return `sonan-${lecture.id.slice(0, 8)}.ics`
}

/**
 * يبني محتوى الملف كاملاً.
 *
 * الموقع يتبع نوع اللقاء كما في عمود «الوجهة»:
 *   عن بُعد   ← رابط الدخول
 *   حضوري     ← المكان
 *   كلاهما    ← المكان، والرابط في الوصف
 */
export function buildIcs(lecture: LectureView, now: Date = new Date()): string {
  const location = lecture.type === 'remote' ? (lecture.join_url ?? '') : lecture.place

  const description: string[] = []
  if (lecture.book) description.push(lecture.book)
  description.push(`الشيخ: ${lecture.sheikh_name}`)
  description.push(`اللقاء رقم ${lecture.ord}`)
  if (lecture.join_url && lecture.type !== 'onsite') description.push(`رابط الدخول: ${lecture.join_url}`)
  if (lecture.map_url && lecture.type !== 'remote') description.push(`الموقع: ${lecture.map_url}`)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sonan//Lectures//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:sonan-${lecture.id}@sonan.sa`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(lecture.starts_at)}`,
    `DTEND:${stamp(lecture.ends_at)}`,
    `SUMMARY:${esc(`${lecture.title} — ${lecture.sheikh_name}`)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(description.join('\n'))}`,
    // اللقاء الملغى يبقى في التقويم موسوماً، ولا يُحذف (القاعدة ٦.٧)
    `STATUS:${lecture.is_cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.map(fold).join('\r\n') + '\r\n'
}
