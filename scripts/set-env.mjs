/**
 * كتابة متغيّر واحد في ‎.env.local من محتوى الحافظة — بلا فتح أي محرّر.
 *
 *   node scripts/set-env.mjs NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * ينسخ المستخدم القيمة من المتصفح (Ctrl+C)، ثم يشغّل الأمر.
 * لا تُطبع القيمة في أي مخرج — تُعرض مقنّعة فقط.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const ENV_FILE = '.env.local'
const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_PASSWORD',
]

const ok = (s) => `\x1b[32m✔\x1b[0m ${s}`
const no = (s) => `\x1b[31m✘\x1b[0m ${s}`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const name = process.argv[2]

if (!name || !KEYS.includes(name)) {
  console.log(`\n${no('اذكر اسم المتغيّر. المسموح:')}`)
  for (const k of KEYS) console.log(dim(`  ${k}`))
  process.exitCode = 1
} else {
  run(name)
}

function clipboard() {
  try {
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'],
      { encoding: 'utf8', windowsHide: true }
    )
    return out.replace(/\r/g, '').replace(/\n+$/, '').trim()
  } catch {
    return null
  }
}

/** يتحقّق أن المنسوخ يشبه ما ننتظره، فلا يُكتب رابطٌ مكان مفتاح */
function validate(key, value) {
  if (!value) return 'الحافظة فارغة — انسخ القيمة أولاً ثم أعد الأمر'

  if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
    if (/^[a-z0-9]{20}$/.test(value))
      return `هذا مُعرِّف المشروع لا رابطه. المطلوب: https://${value}.supabase.co`
    try {
      new URL(value)
    } catch {
      return 'ليس رابطاً صالحاً'
    }
    return null
  }

  if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    if (value.startsWith('sb_secret_')) return 'هذا المفتاح السرّي! العام يبدأ بـ sb_publishable_'
    if (!/^(sb_publishable_|eyJ)/.test(value))
      return 'لا يشبه مفتاحاً عاماً — المتوقّع يبدأ بـ sb_publishable_ أو eyJ'
    return null
  }

  if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
    if (value.startsWith('sb_publishable_'))
      return 'هذا المفتاح العام! السرّي يبدأ بـ sb_secret_ ويحتاج ضغط Reveal'
    if (!/^(sb_secret_|eyJ)/.test(value))
      return 'لا يشبه مفتاحاً سرّياً — المتوقّع يبدأ بـ sb_secret_ أو eyJ'
    return null
  }

  if (key === 'ADMIN_PASSWORD') {
    if (value.length < 8) return 'كلمة المرور قصيرة — ثمانية محارف فأكثر'
    if (/\s/.test(value)) return 'فيها مسافة — احذفها'
    if (!/^[\x21-\x7E]+$/.test(value))
      return 'فيها حروف غير إنجليزية — استعمل حروفاً وأرقاماً إنجليزية فقط'
    return null
  }

  return null
}

const mask = (v) =>
  v.length <= 12 ? '•'.repeat(v.length) : `${v.slice(0, 8)}${'•'.repeat(12)}${v.slice(-4)}`

function run(key) {
  if (!existsSync(ENV_FILE)) {
    console.log(`\n${no(`لم أجد ${ENV_FILE} في هذا المجلد.`)}\n`)
    process.exitCode = 1
    return
  }

  const value = clipboard()
  const problem = validate(key, value)
  if (problem) {
    console.log(`\n${no(problem)}\n`)
    process.exitCode = 1
    return
  }

  const lines = readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)
  let found = false
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true
      return `${key}=${value}`
    }
    return line
  })
  if (!found) next.push(`${key}=${value}`)

  writeFileSync(ENV_FILE, next.filter((l, i) => l !== '' || i < next.length - 1).join('\n') + '\n', 'utf8')

  console.log(`\n${ok(`كُتب ${key}`)}`)
  console.log(dim(`  القيمة: ${key === 'ADMIN_PASSWORD' ? '•'.repeat(value.length) : mask(value)}`))
  console.log(dim(`  الطول : ${value.length} حرفاً\n`))

  // ماذا بقي فارغاً
  const now = readFileSync(ENV_FILE, 'utf8')
  const empty = KEYS.filter((k) => new RegExp(`^${k}=\\s*$`, 'm').test(now))
  if (empty.length) {
    console.log(dim('  ما زال فارغاً:'))
    for (const k of empty) console.log(dim(`    ${k}`))
    console.log('')
  } else {
    console.log(ok('كل المتغيّرات مُعبّأة — شغّل: npm run check:db\n'))
  }
}
