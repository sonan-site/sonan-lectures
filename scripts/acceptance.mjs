/**
 * جولة معايير القبول الاثني عشر — القسم ٩ من تعليمة البناء.
 *
 *   npm run accept            (الخادم على http://localhost:3100)
 *   npm run accept -- <url>
 *
 * «كلها تُثبَت بمخرج، لا بالنظر.» فكل معيار هنا يطبع ما رآه لا حكماً عليه،
 * ولا يُستعمل عدّ الأسطر دليلاً على شيء.
 *
 * ما ينشئه المعياران ١١ و١٢ من بيانات يُزال في آخر الجولة، ويُطبع ما أُزيل.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile('.env.local')

const BASE = process.argv[2] ?? 'http://localhost:3100'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const PW = process.env.ADMIN_PASSWORD

const G = (s) => `\x1b[32m${s}\x1b[0m`
const R = (s) => `\x1b[31m${s}\x1b[0m`
const D = (s) => `\x1b[2m${s}\x1b[0m`
const B = (s) => `\x1b[1m${s}\x1b[0m`

const results = []
let cookie = ''

function record(n, title, passed, evidence) {
  results.push({ n, title, passed })
  console.log(`\n${B(`── المعيار ${n} ·`)} ${title}`)
  for (const line of evidence) console.log(D(`   ${line}`))
  console.log(`   ${passed ? G('✔ محقَّق') : R('✘ غير محقَّق')}`)
}

const supabase = createClient(URL_, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── أدوات ─────────────────────────────────────────────────
async function req(path, init = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', ...init })
  const text = await res.text().catch(() => '')
  return { status: res.status, headers: res.headers, text }
}

function walk(dir, out = []) {
  const skip = new Set(['node_modules', '.next', '.git', '.vercel', 'out', 'build'])
  for (const e of readdirSync(dir)) {
    if (skip.has(e)) continue
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e)) out.push(f)
  }
  return out
}

const files = walk(process.cwd()).map((f) => ({
  rel: relative(process.cwd(), f).split(sep).join('/'),
  src: readFileSync(f, 'utf8'),
}))

console.log(B(`\n╔══ جولة معايير القبول · ${BASE} ══╗`))

// ── ١ · العرض يعطي الحالة live بلا خطأ ────────────────────
{
  const { count, error } = await supabase
    .from('v_lectures')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'live')
  record(1, "select count(*) from v_lectures where status='live'", !error, [
    `الاستعلام : v_lectures where status = 'live'`,
    `المخرج    : ${error ? `خطأ — ${error.message}` : `count = ${count}`}`,
  ])
}

// ── ٢ · الصفحة الرئيسية ───────────────────────────────────
{
  const r = await req('/')
  const clean = r.text.replace(/<!--.*?-->/g, '')
  const found = ['اللقاء القادم', 'لا لقاءات قادمة حالياً', 'يُبثّ الآن'].filter((s) =>
    clean.includes(s)
  )
  const required = found.some((s) => s !== 'يُبثّ الآن')
  record(2, '‏/ يعيد ٢٠٠ ونصّه يحوي «اللقاء القادم» أو «لا لقاءات قادمة حالياً»', r.status === 200 && required, [
    `رمز الاستجابة : ${r.status}`,
    `العبارات      : ${found.join(' · ') || 'لا شيء'}`,
    required
      ? ''
      : 'ملاحظة: يوجد لقاء جارٍ الآن، والنموذج المعتمد يعرض «يُبثّ الآن» — تعارض مسجَّل في DECISIONS.md',
  ].filter(Boolean))
}

// ── ٣ · ترويسة منع التخزين ────────────────────────────────
{
  const r = await req('/')
  const cc = r.headers.get('cache-control') ?? ''
  const ok = /no-store/.test(cc)
  record(3, 'ترويسة / تحوي cache-control يمنع التخزين', ok, [`cache-control: ${cc || '—'}`])
}

// ── ٤ · /admin بلا كوكي ───────────────────────────────────
{
  const r = await req('/admin')
  const loc = r.headers.get('location') ?? ''
  record(4, '‏/admin بلا كوكي يعيد تحويلاً إلى /admin/login', r.status >= 300 && r.status < 400 && loc.includes('/admin/login'), [
    `رمز الاستجابة : ${r.status}`,
    `location      : ${loc || '—'}`,
  ])
}

// ── ٥ · /admin بكوكي صالح ─────────────────────────────────
{
  const login = await fetch(BASE + '/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PW }),
  })
  const raw = login.headers.getSetCookie?.() ?? []
  cookie = raw.map((c) => c.split(';')[0]).join('; ')
  const r = await req('/admin', { headers: { cookie } })
  record(5, '‏/admin بكوكي صالح يعيد ٢٠٠', login.status === 200 && r.status === 200, [
    `تسجيل الدخول : ${login.status}`,
    `اسم الكوكي   : ${raw[0]?.split('=')[0] ?? '—'} · httpOnly: ${/httponly/i.test(raw[0] ?? '') ? 'نعم' : 'لا'}`,
    `‏/admin       : ${r.status}`,
  ])
}

// ── ٦ · مفتاح الخدمة في ملف عميل ──────────────────────────
{
  const leaks = files.filter(
    (f) => /^\s*['"]use client['"]/m.test(f.src) && f.src.includes('SUPABASE_SERVICE_ROLE_KEY')
  )
  record(6, "لا نتيجة لـ SUPABASE_SERVICE_ROLE_KEY في أي ملف فيه 'use client'", leaks.length === 0, [
    `الملفات المفحوصة : ${files.length}`,
    `ملفات 'use client' : ${files.filter((f) => /^\s*['"]use client['"]/m.test(f.src)).length}`,
    `النتائج            : ${leaks.length === 0 ? 'صفر' : leaks.map((f) => f.rel).join(' · ')}`,
  ])
}

// ── ٧ · بادئة NEXT_PUBLIC على مفتاح الخدمة ────────────────
{
  const hits = files.filter(
    (f) => f.rel !== 'scripts/check-secrets.mjs' && f.rel !== 'scripts/acceptance.mjs' &&
      f.src.includes('NEXT_PUBLIC_SUPABASE_SERVICE')
  )
  record(7, 'لا نتيجة لـ NEXT_PUBLIC_SUPABASE_SERVICE إطلاقاً', hits.length === 0, [
    `النتائج : ${hits.length === 0 ? 'صفر (خارج سكربتَي الفحص اللذين يذكران الاسم بحكم عملهما)' : hits.map((f) => f.rel).join(' · ')}`,
  ])
}

// ── ٨ · الكتابة بمفتاح anon مرفوضة ────────────────────────
{
  const { data: s } = await supabase.from('series').select('id').limit(1).single()
  const { data, error } = await supabase
    .from('lectures')
    .insert({ series_id: s?.id, ord: 999, starts_at: new Date(Date.now() + 864e5).toISOString() })
    .select('id')
  record(8, 'محاولة كتابة في lectures بمفتاح anon تُرفض', Boolean(error), [
    `الرمز    : ${error?.code ?? '—'}`,
    `الرسالة  : ${error?.message ?? `لم تُرفض! أُدرج: ${JSON.stringify(data)}`}`,
  ])
}

// ── ٩ · صفحة السلسلة ──────────────────────────────────────
{
  const { data: s } = await supabase.from('series').select('slug').limit(1).single()
  const r = await req(`/s/${s.slug}`)
  const clean = r.text.replace(/<!--.*?-->/g, '')
  const m = clean.match(/أُنجز [٠-٩]+ من [٠-٩]+ لقاء[اًت]*/)
  record(9, '‏/s/<slug-موجود> يعيد ٢٠٠ ونصّه يحوي «أُنجز»', r.status === 200 && clean.includes('أُنجز'), [
    `المسار        : /s/${s.slug}`,
    `رمز الاستجابة : ${r.status}`,
    `النصّ الموجود  : ${m ? m[0] : clean.includes('أُنجز') ? 'أُنجز' : '—'}`,
  ])
}

// ── ١٠ · slug غير موجود ───────────────────────────────────
{
  const r = await req('/sheikh/la-yujad-abadan-2026')
  const arabic404 = r.text.includes('هذه الصفحة غير موجودة')
  record(10, '‏/sheikh/<slug-غير-موجود> يعيد ٤٠٤', r.status === 404, [
    `رمز الاستجابة : ${r.status}`,
    `صفحة عربية    : ${arabic404 ? 'نعم — «هذه الصفحة غير موجودة»' : 'لا'}`,
  ])
}

// ── ١١ · حذف موعد من المعاينة ─────────────────────────────
const TEST_SLUG = 'jawlat-alqubul-11'
{
  const { data: sh } = await supabase
    .from('sheikhs')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  // معاينة من أربعة مواعيد أسبوعية، حُذف الثالث
  const base = new Date('2027-01-05T17:00:00+03:00').getTime()
  const all = [0, 1, 2, 3].map((i) => new Date(base + i * 7 * 86_400_000).toISOString())
  const kept = [all[0], all[1], all[3]]

  const res = await fetch(BASE + '/api/admin/series', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: 'جولة القبول — المعيار ١١',
      slug: TEST_SLUG,
      book: null,
      sheikh_id: sh.id,
      type: 'onsite',
      place: null,
      map_url: null,
      join_url: null,
      duration_min: 60,
      starts: kept,
    }),
  })
  const body = await res.json().catch(() => null)

  const { data: created } = await supabase
    .from('series')
    .select('id')
    .eq('slug', TEST_SLUG)
    .maybeSingle()
  const { data: rows } = created
    ? await supabase.from('lectures').select('ord, starts_at').eq('series_id', created.id).order('ord')
    : { data: [] }

  const ords = (rows ?? []).map((r) => r.ord).join(',')
  record(11, 'سلسلة بأربعة لقاءات، حذف موعد من المعاينة يُنتج ثلاثة بترتيب ١ و٢ و٣', ords === '1,2,3', [
    `المولّدة في المعاينة : ٤ مواعيد — ${all.map((d) => d.slice(0, 10)).join(' · ')}`,
    `المحذوف              : الثالث (${all[2].slice(0, 10)})`,
    `المُرسَل              : ${kept.length}`,
    `استجابة الخادم       : ${res.status} ${JSON.stringify(body)}`,
    `الصفوف في القاعدة    : ${(rows ?? []).length} — ord = ${ords || '—'}`,
    `تواريخها             : ${(rows ?? []).map((r) => r.starts_at.slice(0, 10)).join(' · ')}`,
  ])
}

// ── ١٢ · «عن بُعد» بلا رابط يُرفض ─────────────────────────
{
  const { data: ser } = await supabase
    .from('series')
    .select('id')
    .eq('type', 'onsite')
    .is('join_url', null)
    .limit(1)
    .single()
  const { data: lec } = await supabase
    .from('lectures')
    .select('id, starts_at')
    .eq('series_id', ser.id)
    .order('ord')
    .limit(1)
    .single()

  const d = new Date(lec.starts_at)
  const res = await fetch(BASE + `/api/admin/lectures/${lec.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      date: new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Riyadh',
      }).format(d),
      time: new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Riyadh',
      }).format(d),
      duration_min: null,
      type: 'remote',
      place: null,
      join_url: null,
      is_cancelled: false,
    }),
  })
  const body = await res.json().catch(() => null)
  record(12, 'تعديل لقاء إلى «عن بُعد» بلا رابط يُرفض', res.status >= 400 && Boolean(body?.error), [
    `رمز الاستجابة : ${res.status}`,
    `نصّ الرسالة   : ${body?.error ?? '—'}`,
  ])
}

// ── التنظيف ───────────────────────────────────────────────
{
  const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: gone } = await admin.from('series').select('id').eq('slug', TEST_SLUG).maybeSingle()
  if (gone) {
    await admin.from('series').delete().eq('slug', TEST_SLUG)
    console.log(D(`\n   تنظيف: حُذفت سلسلة الاختبار «${TEST_SLUG}» ولقاءاتها الثلاثة.`))
  } else {
    console.log(D('\n   تنظيف: لا شيء لحذفه.'))
  }
  const [{ count: sh }, { count: se }, { count: le }] = await Promise.all([
    admin.from('sheikhs').select('*', { count: 'exact', head: true }),
    admin.from('series').select('*', { count: 'exact', head: true }),
    admin.from('lectures').select('*', { count: 'exact', head: true }),
  ])
  console.log(D(`   حالة القاعدة: ${sh} مشايخ · ${se} سلاسل · ${le} لقاءً.`))
}

// ── الخلاصة ───────────────────────────────────────────────
const passed = results.filter((r) => r.passed).length
console.log(B(`\n╔══ الخلاصة ══╗`))
for (const r of results) {
  console.log(`  ${r.passed ? G('✔') : R('✘')} ${String(r.n).padStart(2)} · ${r.title}`)
}
console.log(B(`\n  ${passed} من ${results.length} محقَّق.\n`))
process.exitCode = passed === results.length ? 0 : 1
