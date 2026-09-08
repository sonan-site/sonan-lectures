/**
 * فحص الاستيراد والتصدير — إكسل.
 *
 *   npm run dev                    (نافذة)
 *   npm run check:import-export    (نافذة أخرى)
 *
 * يبني ملفّي اختبار (صالح وفاسد) بـ`exceljs` في الذاكرة، يرفعهما عبر
 * `fetch`+`FormData` كما يفعل متصفح حقيقي، ويتحقّق من الاستجابة ومن
 * قاعدة البيانات مباشرةً. ينظّف بياناته بنفسه فلا يمسّ الزرع.
 */
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
process.loadEnvFile('.env.local')

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const g = (s) => `\x1b[32m✔\x1b[0m ${s}`
const r = (s) => `\x1b[31m✘\x1b[0m ${s}`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const head = (s) => `\n\x1b[1m── ${s} \x1b[0m${'─'.repeat(Math.max(0, 54 - s.length))}`

let failed = 0
const expect = (cond, msg) => {
  console.log(cond ? g(msg) : r(msg))
  if (!cond) failed++
}

let cookie = ''
async function apiJson(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, json }
}

async function upload(path, buffer, filename) {
  const form = new FormData()
  form.append('file', new Blob([buffer]), filename)
  const res = await fetch(BASE + path, { method: 'POST', headers: { cookie }, body: form })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, json }
}

async function download(path, withCookie = true) {
  const res = await fetch(BASE + path, { headers: withCookie ? { cookie } : {} })
  const buf = Buffer.from(await res.arrayBuffer())
  return { status: res.status, contentType: res.headers.get('content-type'), buf }
}

const TAG = 'fahs-istyrd'

async function cleanup() {
  await db.from('series').delete().like('slug', `${TAG}%`)
  const { data: sh } = await db.from('sheikhs').select('id').eq('slug', `${TAG}-sheikh`)
  for (const s of sh ?? []) await db.from('series').delete().eq('sheikh_id', s.id)
  await db.from('sheikhs').delete().eq('slug', `${TAG}-sheikh`)
}

await cleanup()
// لا يُفترَض عدد ثابت للزرع (قد يكون حُذف أو أُعيد زرعه) — يُقاس قبل
// وبعد بدلاً من افتراض رقم معيّن، فيبقى الفحص صحيحاً في الحالتين.
const { count: baselineLectures } = await db
  .from('lectures')
  .select('id', { count: 'exact', head: true })

// ═══ ٠ · الحارس بلا جلسة على المسارات الثلاثة ═══════════════
console.log(head('الحارس · القاعدة ٦.٥'))
const noAuth1 = await download('/api/admin/series/import-template', false)
expect(noAuth1.status === 401, `القالب بلا جلسة يُرفض ٤٠١ (${noAuth1.status})`)
const noAuth2 = await download('/api/admin/export', false)
expect(noAuth2.status === 401, `التصدير بلا جلسة يُرفض ٤٠١ (${noAuth2.status})`)
const emptyBuf = await (async () => {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('السلاسل واللقاءات')
  return wb.xlsx.writeBuffer()
})()
const noAuth3Form = new FormData()
noAuth3Form.append('file', new Blob([emptyBuf]), 'x.xlsx')
const noAuth3 = await fetch(`${BASE}/api/admin/series/import`, { method: 'POST', body: noAuth3Form })
expect(noAuth3.status === 401, `الاستيراد بلا جلسة يُرفض ٤٠١ (${noAuth3.status})`)

// ═══ ١ · الدخول ══════════════════════════════════════════════
const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
})
cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
if (!cookie) {
  console.log(r('تعذّر تسجيل الدخول'))
  process.exit(1)
}
console.log(g('جلسة مشرف قائمة'))

// ═══ ٢ · بناء شيخ الفحص ══════════════════════════════════════
await apiJson('POST', '/api/admin/sheikhs', { name: 'شيخ الاستيراد', slug: `${TAG}-sheikh` })
console.log(g('أُنشئ قالب شيخ للفحص'))

// ═══ ٣ · القالب: يُفتح، ويحمل الورقتين والشيخ في القائمة المرجعية ═══
console.log(head('القالب المولَّد'))
const tmpl = await download('/api/admin/series/import-template')
expect(tmpl.status === 200, `القالب يُنزَّل (${tmpl.status})`)
expect(
  (tmpl.contentType ?? '').includes('spreadsheetml'),
  `نوع المحتوى إكسل صحيح (${tmpl.contentType})`
)
const tmplWb = new ExcelJS.Workbook()
await tmplWb.xlsx.load(tmpl.buf)
const sheetNames = tmplWb.worksheets.map((s) => s.name)
expect(sheetNames.includes('السلاسل واللقاءات'), `تحوي ورقة البيانات (${sheetNames.join('،')})`)
expect(sheetNames.includes('تعليمات'), 'تحوي ورقة التعليمات')

// ═══ ٤ · ملف صالح: سلسلتان بخمسة لقاءات ═══════════════════════
console.log(head('استيراد ملف صالح'))

const HEADERS = [
  'رابط السلسلة', 'عنوان اللقاء', 'الكتاب', 'رابط الشيخ',
  'مقدار اللقاء — من', 'مقدار اللقاء — إلى', 'النوع',
  'المكان', 'رابط الخرائط', 'رابط الدخول', 'المدة بالدقيقة',
  'تاريخ اللقاء', 'وقت اللقاء',
]

function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('السلاسل واللقاءات')
  ws.addRow(HEADERS)
  for (const row of rows) ws.addRow(row)
  return wb
}

const day = (n) => {
  const d = new Date(Date.now() + n * 86_400_000)
  return d.toISOString().slice(0, 10)
}

const slugA = `${TAG}-a`
const slugB = `${TAG}-b`
const sheikhSlug = `${TAG}-sheikh`

const goodRows = [
  [slugA, 'سلسلة الفحص أ', 'كتاب أ', sheikhSlug, 'باب الفحص الأول', 'باب الفحص الثاني', 'حضوري', 'قاعة الفحص', '', '', 60, day(10), '19:00'],
  [slugA, 'سلسلة الفحص أ', 'كتاب أ', sheikhSlug, '', '', 'حضوري', 'قاعة الفحص', '', '', 60, day(17), '19:00'],
  [slugA, 'سلسلة الفحص أ', 'كتاب أ', sheikhSlug, '', '', 'حضوري', 'قاعة الفحص', '', '', 60, day(24), '19:00'],
  [slugB, 'سلسلة الفحص ب', '', sheikhSlug, '', '', 'عن بُعد', '', '', 'https://meet.example/fahs', 45, day(11), '20:30'],
  [slugB, 'سلسلة الفحص ب', '', sheikhSlug, '', '', 'عن بُعد', '', '', 'https://meet.example/fahs', 45, day(18), '20:30'],
]

const goodBuf = await buildWorkbook(goodRows).xlsx.writeBuffer()
const good = await upload('/api/admin/series/import', goodBuf, 'good.xlsx')
expect(good.status === 200, `الملف الصالح يُقبل (${good.status})`)
expect(good.json?.created?.length === 2, `سلسلتان أُنشئتا (${good.json?.created?.length})`)
expect(good.json?.totalLectures === 5, `خمسة لقاءات إجمالاً (${good.json?.totalLectures})`)
console.log(dim(`  ${(good.json?.created ?? []).map((c) => `${c.slug}:${c.count}`).join(' · ')}`))

const seriesA = await db.from('series').select('id, sheikh_id, sheikh_name').eq('slug', slugA).single()
expect(seriesA.data?.sheikh_id === null, 'سلسلة أ بلا شيخ افتراضي — الاستيراد لا يُرقّي شيخاً مشتركاً للسلسلة')

const { count: dbCountA, data: lecturesA } = await db
  .from('lectures')
  .select('id, sheikh_id, scope_from, scope_to', { count: 'exact' })
  .eq('series_id', seriesA.data?.id)
  .order('ord', { ascending: true })
expect(dbCountA === 3, `سلسلة أ فيها ٣ لقاءات في القاعدة فعلاً (${dbCountA})`)
expect(
  (lecturesA ?? []).every((l) => l.sheikh_id !== null),
  'كل لقاء في سلسلة أ يحمل شيخه الخاص (لا سلسلته)'
)
expect(
  lecturesA?.[0]?.scope_from === 'باب الفحص الأول' && lecturesA?.[0]?.scope_to === 'باب الفحص الثاني',
  'مقدار اللقاء الأول استُورد صحيحاً'
)
expect(
  lecturesA?.[1]?.scope_from === null && lecturesA?.[1]?.scope_to === null,
  'مقدار اللقاء الثاني فارغ كما تُرك في الملف'
)

// ═══ ٥ · إعادة رفع الملف نفسه — يُرفض بسبب تكرار الروابط ═══════
console.log(head('إعادة الرفع · روابط مكرَّرة'))
const dup = await upload('/api/admin/series/import', goodBuf, 'good.xlsx')
expect(dup.status === 422, `يُرفض ٤٢٢ (${dup.status})`)
expect(
  (dup.json?.issues ?? []).some((i) => i.message.includes('مستخدم بالفعل')),
  'رسالة تذكر أن الرابط مستخدم بالفعل'
)
expect(
  (dup.json?.issues ?? []).length >= 2,
  `خطأ لكل سلسلة مكرَّرة على الأقل (${dup.json?.issues?.length})`
)

const { count: stillA } = await db
  .from('series')
  .select('id', { count: 'exact', head: true })
  .eq('slug', slugA)
expect(stillA === 1, 'لم تتكرّر السلسلة في القاعدة — الرفض لم يكتب شيئاً')

// ═══ ٦ · ملف فاسد بأربعة أخطاء مستقلّة — لا شيء يُكتَب ═════════
console.log(head('ملف فاسد · لا كتابة جزئية'))
const slugC = `${TAG}-c` // شيخ غير موجود
const slugD = `${TAG}-d` // مدة خارج المدى
const slugE = `${TAG}-e` // عدم تطابق العنوان بين صفوف الرابط نفسه
const slugF = `${TAG}-f` // تاريخ ووقت مكرَّران داخل السلسلة نفسها
const slugG = `${TAG}-g` // رابط الشيخ فارغ — إلزاميّ لكل صفّ منذ هجرة ٠٠٣
const badRows = [
  [slugC, 'سلسلة الفحص ج', '', 'la-yujad-abadan', '', '', 'حضوري', 'مكان', '', '', 60, day(12), '19:00'],
  [slugD, 'سلسلة الفحص د', '', sheikhSlug, '', '', 'حضوري', 'مكان', '', '', 999, day(13), '19:00'],
  [slugE, 'سلسلة الفحص هـ', '', sheikhSlug, '', '', 'حضوري', 'مكان', '', '', 60, day(14), '19:00'],
  [slugE, 'عنوان مختلف تماماً', '', sheikhSlug, '', '', 'حضوري', 'مكان', '', '', 60, day(21), '19:00'],
  [slugF, 'سلسلة الفحص و', '', sheikhSlug, '', '', 'حضوري', 'مكان', '', '', 60, day(15), '19:00'],
  [slugF, 'سلسلة الفحص و', '', sheikhSlug, '', '', 'حضوري', 'مكان', '', '', 60, day(15), '19:00'],
  [slugG, 'سلسلة الفحص ز', '', '', '', '', 'حضوري', 'مكان', '', '', 60, day(16), '19:00'],
]
const badBuf = await buildWorkbook(badRows).xlsx.writeBuffer()
const bad = await upload('/api/admin/series/import', badBuf, 'bad.xlsx')
expect(bad.status === 422, `يُرفض ٤٢٢ (${bad.status})`)
expect(
  (bad.json?.issues ?? []).length >= 5,
  `خمسة أخطاء مستقلّة على الأقل مجموعة معاً (${bad.json?.issues?.length})`
)
console.log(dim('  ' + (bad.json?.issues ?? []).map((i) => `صف ${i.row}: ${i.message}`).join('\n  ')))

const { count: noBad } = await db
  .from('series')
  .select('id', { count: 'exact', head: true })
  .in('slug', [slugC, slugD, slugE, slugF, slugG])
expect(noBad === 0, 'لا سلسلة واحدة من الملف الفاسد كُتبت — ولو جزئياً')

// ═══ ٧ · التصدير ═════════════════════════════════════════════
console.log(head('التصدير'))
const exp = await download('/api/admin/export')
expect(exp.status === 200, `يُنزَّل (${exp.status})`)
const expWb = new ExcelJS.Workbook()
await expWb.xlsx.load(exp.buf)
const expNames = expWb.worksheets.map((s) => s.name)
expect(expNames.includes('السلاسل') && expNames.includes('اللقاءات'), `ورقتان صحيحتان (${expNames.join('،')})`)
const lecSheet = expWb.getWorksheet('اللقاءات')
// ٥ لقاءات الفحص (الخطوة ٤) ما زالت في القاعدة هنا — التنظيف يقع بعدها
expect(lecSheet.rowCount >= 6, `صفوف اللقاءات تشمل رأساً و٥ لقاءات الفحص على الأقل (${lecSheet.rowCount})`)
const scopeFromCol = lecSheet.getRow(1).values.indexOf('مقدار اللقاء — من')
expect(scopeFromCol > 0, 'عمود «مقدار اللقاء — من» موجود في ورقة التصدير')

// ═══ التنظيف ══════════════════════════════════════════════════
await cleanup()
const { count: afterLectures } = await db.from('lectures').select('id', { count: 'exact', head: true })
expect(
  afterLectures === baselineLectures,
  `ما كان موجوداً قبل الفحص لم يُمسّ (${baselineLectures} قبل، ${afterLectures} بعد)`
)

console.log('\n' + '═'.repeat(58))
console.log(
  failed === 0
    ? '\x1b[32mالاستيراد والتصدير سليمان — كل التوقّعات تحقّقت.\x1b[0m\n'
    : `\x1b[31mأخفق ${failed} توقّعاً.\x1b[0m\n`
)
process.exitCode = failed ? 1 : 0
