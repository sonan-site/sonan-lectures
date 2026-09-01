/**
 * فحص الحذف والأرشفة — الدفعة الثانية.
 *
 *   npm run dev            (نافذة)
 *   npm run check:delete   (نافذة أخرى)
 *
 * يبني بياناته بنفسه ويمحوها بنفسه، فلا يمسّ الزرع ولا أي بيانات حقيقية.
 * وكل نداء يمرّ بالمعالج عبر HTTP لا بمفتاح الخدمة مباشرةً — فيُختبر معه
 * الحارس `requireAdmin` والتحقّق من المدخلات والرسائل العربية.
 */
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
async function api(method, path, body) {
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

const TAG = 'fahs-hadhf'
async function cleanup() {
  const { data } = await db.from('sheikhs').select('id').like('slug', `${TAG}%`)
  for (const s of data ?? []) await db.from('series').delete().eq('sheikh_id', s.id)
  await db.from('series').delete().like('slug', `${TAG}%`)
  await db.from('sheikhs').delete().like('slug', `${TAG}%`)
}

await cleanup()

// ═══ ٠ · الحارس قبل الدخول ═══════════════════════════════════
console.log(head('الحارس · القاعدة ٦.٥'))
const anon = await fetch(
  `${BASE}/api/admin/series/00000000-0000-4000-8000-000000000000?expect=0`,
  { method: 'DELETE' }
)
expect(anon.status === 401, `الحذف بلا جلسة يُرفض ٤٠١ (${anon.status})`)

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

// ═══ ٢ · بناء بيانات الفحص ═══════════════════════════════════
console.log(head('بناء بيانات الفحص'))
await api('POST', '/api/admin/sheikhs', { name: 'شيخ الفحص', slug: `${TAG}-sheikh` })
const { data: sh } = await db
  .from('sheikhs')
  .select('id, name, slug')
  .eq('slug', `${TAG}-sheikh`)
  .single()
expect(Boolean(sh), 'أُنشئ قالب شيخ للفحص')

const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString()
const mk = await api('POST', '/api/admin/series', {
  title: 'سلسلة الفحص',
  slug: `${TAG}-series`,
  sheikh_id: sh.id,
  type: 'onsite',
  duration_min: 60,
  starts: [day(10), day(17), day(24), day(31)],
})
expect(mk.status === 200, `أُنشئت سلسلة بأربعة لقاءات (${mk.status})`)

const { data: ser } = await db
  .from('series')
  .select('id, sheikh_id, sheikh_name, sheikh_slug')
  .eq('slug', `${TAG}-series`)
  .single()

// ═══ ٣ · اللقطة تُكتب عند الإنشاء ════════════════════════════
console.log(head('النموذج القالبي'))
expect(
  ser.sheikh_name === sh.name && ser.sheikh_slug === sh.slug,
  `السلسلة تحمل لقطة الشيخ: ${ser.sheikh_name} · ${ser.sheikh_slug}`
)

// ═══ ٤ · حذف لقاء من الوسط ⇐ إعادة ترقيم ════════════════════
console.log(head('حذف لقاء · إعادة الترقيم · المعيار ١١'))
const ordsOf = async () =>
  (await db.from('lectures').select('ord').eq('series_id', ser.id).order('ord')).data.map(
    (l) => l.ord
  )
expect(JSON.stringify(await ordsOf()) === '[1,2,3,4]', 'الترتيب قبل الحذف: ١ ٢ ٣ ٤')

const { data: mid } = await db
  .from('lectures')
  .select('id')
  .eq('series_id', ser.id)
  .eq('ord', 2)
  .single()
const del = await api('DELETE', `/api/admin/lectures/${mid.id}`)
expect(del.status === 200, `حُذف اللقاء الثاني (${del.status})`)
console.log(dim(`  ${del.json?.message ?? ''}`))
expect(JSON.stringify(await ordsOf()) === '[1,2,3]', 'الترتيب بعده: ١ ٢ ٣ — بلا فجوة')
expect(del.json?.remaining === 3, `الدالّة تعيد العدد الباقي (${del.json?.remaining})`)

const gone = await api('DELETE', `/api/admin/lectures/${mid.id}`)
expect(gone.status === 404, `حذف لقاء محذوف يعيد ٤٠٤ بالعربية (${gone.status})`)
console.log(dim(`  ${gone.json?.error ?? ''}`))

// ═══ ٥ · الأرشفة ═════════════════════════════════════════════
console.log(head('الأرشفة والاسترجاع'))
const visible = async () =>
  (await db.from('v_lectures').select('id').eq('series_id', ser.id)).data.length
const inAdmin = async () =>
  (await db.from('v_lectures_admin').select('id').eq('series_id', ser.id)).data.length

expect((await visible()) === 3 && (await inAdmin()) === 3, 'قبل الأرشفة: ٣ ظاهرة · ٣ في اللوحة')

const { data: one } = await db
  .from('lectures')
  .select('id')
  .eq('series_id', ser.id)
  .eq('ord', 1)
  .single()
const arc = await api('PATCH', `/api/admin/lectures/${one.id}`, { action: 'archive' })
expect(arc.status === 200, `أُرشف لقاء واحد (${arc.status})`)
expect(
  (await visible()) === 2 && (await inAdmin()) === 3,
  'اللقاء المؤرشف اختفى عن الزائر وبقي في اللوحة — القاعدة ٦.١'
)

const sArc = await api('PATCH', `/api/admin/series/${ser.id}`, { action: 'archive' })
expect(sArc.status === 200, `أُرشفت السلسلة (${sArc.status})`)
console.log(dim(`  ${sArc.json?.message ?? ''}`))
expect(
  (await visible()) === 0 && (await inAdmin()) === 3,
  'السلسلة المؤرشفة تُخفي لقاءاتها كلها عن الزائر وتبقى كاملة في اللوحة'
)

const { data: sPage } = await db
  .from('series')
  .select('id')
  .eq('sheikh_slug', sh.slug)
  .is('archived_at', null)
expect(sPage.length === 0, 'وصفحة الشيخ تصير ٤٠٤ ما دامت كل سلاسله مؤرشفة')

const sRes = await api('PATCH', `/api/admin/series/${ser.id}`, { action: 'restore' })
expect(
  sRes.status === 200 && (await visible()) === 2,
  'الاسترجاع يعيدها كما كانت — واللقاء المؤرشف يبقى مؤرشفاً'
)
await api('PATCH', `/api/admin/lectures/${one.id}`, { action: 'restore' })
expect((await visible()) === 3, 'واسترجاع اللقاء يعيده أيضاً')

// ═══ ٦ · حذف الشيخ لا يمسّ سلاسله ════════════════════════════
console.log(head('حذف قالب الشيخ · نقض ٦.٦ بحفظ غرضها'))
const wrongN = await api('DELETE', `/api/admin/sheikhs/${sh.id}?expect=9`)
expect(wrongN.status === 409, `عدد سلاسل غير مطابق يُرفض ٤٠٩ (${wrongN.status})`)
console.log(dim(`  ${wrongN.json?.error ?? ''}`))

const dSh = await api('DELETE', `/api/admin/sheikhs/${sh.id}?expect=1`)
expect(dSh.status === 200, `حُذف قالب الشيخ (${dSh.status})`)
console.log(dim(`  ${dSh.json?.message ?? ''}`))

const { data: after } = await db
  .from('series')
  .select('id, sheikh_id, sheikh_name, sheikh_slug')
  .eq('id', ser.id)
  .single()
expect(after !== null, 'السلسلة باقية لم تُحذف معه')
expect(after.sheikh_id === null, 'ومرجعها فُرِّغ — on delete set null')
expect(
  after.sheikh_name === sh.name && after.sheikh_slug === sh.slug,
  `واسمه ورابطه باقيان في اللقطة: ${after.sheikh_name}`
)
expect((await visible()) === 3, 'ولقاءاته الثلاثة ما زالت ظاهرة للزائر')

const { data: stillPage } = await db
  .from('series')
  .select('sheikh_name')
  .eq('sheikh_slug', sh.slug)
  .is('archived_at', null)
  .limit(1)
expect(stillPage.length === 1, `ورابطه العام /sheikh/${sh.slug} ما زال يعمل`)

// ═══ ٧ · حذف السلسلة ═════════════════════════════════════════
console.log(head('حذف السلسلة · الأثر ٨.٢'))
const wrong = await api('DELETE', `/api/admin/series/${ser.id}?expect=99`)
expect(wrong.status === 409, `عدد لقاءات غير مطابق يُرفض ٤٠٩ (${wrong.status})`)
console.log(dim(`  ${wrong.json?.error ?? ''}`))

const noExpect = await api('DELETE', `/api/admin/series/${ser.id}`)
expect(noExpect.status === 400, `حذف بلا expect يُرفض ٤٠٠ (${noExpect.status})`)

const dSer = await api('DELETE', `/api/admin/series/${ser.id}?expect=3`)
expect(dSer.status === 200, `حُذفت السلسلة (${dSer.status})`)
console.log(dim(`  ${dSer.json?.message ?? ''}`))
const { count: left } = await db
  .from('lectures')
  .select('id', { count: 'exact', head: true })
  .eq('series_id', ser.id)
expect(left === 0, 'ولقاءاتها معها — cascade')

// ═══ ٨ · الزرع لم يُمسّ ══════════════════════════════════════
console.log(head('الزرع سليم'))
const { count: seedN } = await db.from('lectures').select('id', { count: 'exact', head: true })
expect(seedN === 15, `اللقاءات الخمسة عشر كما هي (${seedN})`)

await cleanup()
console.log('\n' + '═'.repeat(58))
console.log(
  failed === 0
    ? '\x1b[32mالحذف والأرشفة سليمان — كل التوقّعات تحقّقت.\x1b[0m\n'
    : `\x1b[31mأخفق ${failed} توقّعاً.\x1b[0m\n`
)
process.exitCode = failed ? 1 : 0
