/**
 * اقتراح رابط الصفحة من العنوان العربي — منقول حرفياً من `slugify()`
 * في `prototype/admin.html`.
 *
 * الرابط مقروح لا مولَّد عشوائياً: `/s/bulugh-almaram` يُنشر ويُرسَل ويُقرأ.
 * والمشرف يعدّله قبل الحفظ، ولا يُغيَّر بعد نشره.
 */

const AR_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
}

const TRANSLIT: Record<string, string> = {
  ا: 'a',
  أ: 'a',
  إ: 'a',
  آ: 'a',
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'j',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'dh',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  ة: 'h',
  و: 'w',
  ي: 'y',
  ى: 'a',
  ء: '',
  ئ: '',
  ؤ: '',
}

export function slugify(text: string): string {
  return String(text)
    .trim()
    .split('')
    .map((c) => AR_DIGITS[c] ?? TRANSLIT[c] ?? (/[a-zA-Z0-9]/.test(c) ? c.toLowerCase() : ' '))
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

/** يضيف رقماً إن كان الرابط مستعملاً — `bulugh-almaram-2` */
export function uniqueSlug(base: string, taken: string[]): string {
  const root = base || 'series'
  let candidate = root
  let n = 2
  while (taken.includes(candidate)) {
    candidate = `${root}-${n++}`
  }
  return candidate
}
