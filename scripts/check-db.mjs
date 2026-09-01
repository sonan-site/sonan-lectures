/**
 * فحص الاتصال بـ Supabase — المرحلة ١ من ترتيب البناء.
 *
 * يُشغَّل بـ:  npm run check:db
 *
 * يثبت أربعة أشياء بمخرج ملموس:
 *   ١. متغيّرات البيئة موجودة (بلا طباعة أي قيمة سرّية)
 *   ٢. الاتصال بالقاعدة يعمل بالمفتاح العام
 *   ٣. العرض v_lectures يعطي الحالات الأربع (فحص ٤.٣)
 *   ٤. الكتابة بالمفتاح العام مرفوضة (معيار القبول ٨) — ويطبع نصّ الرفض
 */

import { createClient } from '@supabase/supabase-js'

const ok = (s) => `\x1b[32m✔\x1b[0m ${s}`
const no = (s) => `\x1b[31m✘\x1b[0m ${s}`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

let failed = 0
const fail = (m) => {
  failed++
  console.log(no(m))
}

async function main() {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    console.error('\n✘ لم أجد ملف ‎.env.local في جذر المشروع.\n')
    return 1
  }

  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
  const PWD = process.env.ADMIN_PASSWORD

  // ---------- ١ · متغيّرات البيئة ----------
  console.log('\n── ١ · متغيّرات البيئة ' + '─'.repeat(38))
  for (const [name, val] of [
    ['NEXT_PUBLIC_SUPABASE_URL', URL_],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON],
    ['SUPABASE_SERVICE_ROLE_KEY', SVC],
    ['ADMIN_PASSWORD', PWD],
  ]) {
    if (!val) fail(`${name} — فارغ أو غير معرَّف`)
    else console.log(ok(`${name} ${dim(`(${val.length} حرفاً)`)}`))
  }
  if (!URL_ || !ANON) {
    console.log('\nلا يمكن المتابعة بلا الرابط والمفتاح العام.\n')
    return 1
  }
  if (SVC && SVC === ANON) fail('مفتاح الخدمة يساوي المفتاح العام — أحدهما منسوخ خطأً')

  let host
  try {
    host = new URL(URL_).hostname
  } catch {
    fail(`NEXT_PUBLIC_SUPABASE_URL ليست رابطاً صالحاً: «${URL_}»`)
    console.log(dim(`  المتوقّع: https://${URL_}.supabase.co`))
    return 1
  }
  console.log(dim(`  المشروع: ${host.split('.')[0]}`))

  // ---------- ٢ · الاتصال ----------
  console.log('\n── ٢ · الاتصال بالقاعدة ' + '─'.repeat(37))
  const supabase = createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const t0 = Date.now()
  const { data: settings, error: connErr } = await supabase
    .from('settings')
    .select('hq_place, hq_map_url, logo_url')
    .single()

  if (connErr) {
    fail(`تعذّر الاتصال: ${connErr.message}`)
    if (/invalid api key/i.test(connErr.message)) {
      console.log(
        dim(
          '\n  المفتاح مرفوض. الأرجح أن مفاتيح JWT القديمة معطّلة في المشروع.\n' +
            '  افتح Project Settings ← API Keys واستعمل المفتاحين الجديدين:\n' +
            '    sb_publishable_…  ⟵  NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
            '    sb_secret_…       ⟵  SUPABASE_SERVICE_ROLE_KEY\n'
        )
      )
    }
    return 1
  }

  console.log(ok(`الاتصال يعمل ${dim(`(${Date.now() - t0} مللي ثانية)`)}`))
  console.log(ok(`المقر الافتراضي: ${settings.hq_place}`))
  console.log(
    settings.logo_url ? ok('الشعار مرفوع') : dim('  ○ لا شعار بعد — يُرفع من تبويب الإعدادات')
  )

  // ---------- ٣ · فحص ٤.٣ ----------
  console.log('\n── ٣ · فحص ٤.٣ · الحالات في v_lectures ' + '─'.repeat(22))
  const { data: rows, error: viewErr } = await supabase.from('v_lectures').select('status')

  if (viewErr) {
    fail(`العرض v_lectures لا يستجيب: ${viewErr.message}`)
  } else {
    const counts = {}
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1
    for (const s of ['upcoming', 'live', 'done', 'cancelled']) {
      const n = counts[s] ?? 0
      console.log(n > 0 ? ok(`${s.padEnd(10)} ${n}`) : dim(`  ○ ${s.padEnd(10)} 0`))
    }
    console.log(dim(`  المجموع: ${rows.length} لقاءً`))
    if (rows.length === 0) fail('العرض فارغ — هل شُغِّل seed.sql؟')
  }

  // ---------- ٤ · معيار القبول ٨ ----------
  console.log('\n── ٤ · معيار القبول ٨ · رفض الكتابة بالمفتاح العام ' + '─'.repeat(10))
  const { data: anySeries } = await supabase.from('series').select('id').limit(1).single()

  const { data: wrote, error: writeErr } = await supabase
    .from('lectures')
    .insert({
      series_id: anySeries?.id ?? '00000000-0000-0000-0000-000000000000',
      ord: 999,
      starts_at: new Date(Date.now() + 864e5).toISOString(),
    })
    .select('id')

  if (writeErr) {
    console.log(ok('الكتابة مرفوضة — كما تقتضي القاعدة ٦.٥'))
    console.log(dim(`  الرمز    : ${writeErr.code ?? '—'}`))
    console.log(dim(`  الرسالة  : ${writeErr.message}`))
    if (writeErr.details) console.log(dim(`  التفصيل  : ${writeErr.details}`))
  } else {
    fail('خطر: الكتابة بالمفتاح العام نجحت! سياسات RLS ليست كما ينبغي.')
    console.log(dim(`  الصف المُدرَج: ${JSON.stringify(wrote)}`))
    console.log(dim('  لم أحذفه — احذفه يدوياً وراجع سياسات الجدول.'))
  }

  return failed === 0 ? 0 : 1
}

const code = await main()
console.log('\n' + '═'.repeat(60))
console.log(
  code === 0 ? '\x1b[32mكل الفحوص نجحت.\x1b[0m\n' : `\x1b[31mأخفق ${failed} فحصاً.\x1b[0m\n`
)
process.exitCode = code
