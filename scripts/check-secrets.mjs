/**
 * حارس تسرّب المفاتيح — معيارا القبول ٦ و٧ من القسم ٩.
 *
 * يُشغَّل بـ:  npm run check:secrets
 *
 *   معيار ٦: لا وجود لـ SUPABASE_SERVICE_ROLE_KEY في أي ملف فيه 'use client'
 *   معيار ٧: لا وجود لـ NEXT_PUBLIC_SUPABASE_SERVICE إطلاقاً
 *
 * وزدتُ عليهما فحصين: أن مفتاح الخدمة لا يُستورَد إلا من lib/server أو app/api
 * (القاعدة ٦.٤)، وألّا يكون أي مفتاح ملصوقاً حرفياً في الكود.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.vercel', 'out', 'build'])
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXT.test(entry)) out.push(full)
  }
  return out
}

const files = walk(ROOT).map((f) => ({
  path: f,
  rel: relative(ROOT, f).split(sep).join('/'),
  src: readFileSync(f, 'utf8'),
}))

// السكربتات نفسها تذكر أسماء المفاتيح بحكم عملها — تُستثنى من فحص الذِّكر
const isSelf = (rel) => rel.startsWith('scripts/check-') || rel === 'scripts/acceptance.mjs'

/**
 * الملفات التي قد ينتهي بها المطاف في حزمة المتصفح.
 * القاعدة ٦.٤ تخصّ كود التطبيق: ما تحت `scripts/` أدوات تشغيل لا تُشحن،
 * فذِكرها اسمَ المتغيّر ليس تسرّباً. أما `app/` و`lib/` و`components/` فتُحاسَب.
 */
const isShipped = (rel) =>
  rel.startsWith('app/') || rel.startsWith('lib/') || rel.startsWith('components/')

const ok = (s) => `\x1b[32m✔\x1b[0m ${s}`
const no = (s) => `\x1b[31m✘\x1b[0m ${s}`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

let failed = 0
console.log(`\nفُحِص ${files.length} ملفاً.\n`)

// ---------- معيار ٦ ----------
console.log('── معيار ٦ · مفتاح الخدمة في ملف عميل ' + '─'.repeat(23))
const clientLeaks = files.filter(
  (f) =>
    /^\s*['"]use client['"]/m.test(f.src) &&
    f.src.includes('SUPABASE_SERVICE_ROLE_KEY')
)
if (clientLeaks.length === 0) {
  console.log(ok("لا ملف فيه 'use client' يذكر SUPABASE_SERVICE_ROLE_KEY"))
} else {
  failed++
  console.log(no('تسرّب! المفتاح مذكور في ملفات عميل:'))
  for (const f of clientLeaks) console.log(dim(`  ${f.rel}`))
}

// ---------- معيار ٧ ----------
console.log('\n── معيار ٧ · بادئة NEXT_PUBLIC على مفتاح الخدمة ' + '─'.repeat(13))
const publicPrefixed = files.filter(
  (f) => !isSelf(f.rel) && f.src.includes('NEXT_PUBLIC_SUPABASE_SERVICE')
)
if (publicPrefixed.length === 0) {
  console.log(ok('لا وجود لـ NEXT_PUBLIC_SUPABASE_SERVICE في أي ملف'))
} else {
  failed++
  console.log(no('وُجدت البادئة الخطرة في:'))
  for (const f of publicPrefixed) console.log(dim(`  ${f.rel}`))
}

// ---------- القاعدة ٦.٤ ----------
console.log('\n── القاعدة ٦.٤ · موضع استعمال مفتاح الخدمة ' + '─'.repeat(17))
const allowed = (rel) => rel.startsWith('lib/server/') || rel.startsWith('app/api/')
const misplaced = files.filter(
  (f) => isShipped(f.rel) && !allowed(f.rel) && f.src.includes('SUPABASE_SERVICE_ROLE_KEY')
)
if (misplaced.length === 0) {
  console.log(ok('المفتاح لا يُقرأ إلا داخل lib/server/** أو app/api/**'))
} else {
  failed++
  console.log(no('المفتاح مقروء خارج الموضع المسموح:'))
  for (const f of misplaced) console.log(dim(`  ${f.rel}`))
}

// ---------- كلمة مرور اللوحة ----------
console.log('\n── إضافي · كلمة مرور اللوحة ' + '─'.repeat(32))
const pwdLeaks = files.filter(
  (f) => isShipped(f.rel) && !allowed(f.rel) && f.src.includes('ADMIN_PASSWORD')
)
if (pwdLeaks.length === 0) {
  console.log(ok('ADMIN_PASSWORD لا تُقرأ إلا داخل lib/server/** أو app/api/**'))
} else {
  failed++
  console.log(no('كلمة مرور اللوحة مقروءة خارج الخادم:'))
  for (const f of pwdLeaks) console.log(dim(`  ${f.rel}`))
}

// وقيمتها الفعلية: هل تسرّبت إلى حزمة المتصفح المبنيّة؟
function walkAll(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walkAll(f, acc)
    else acc.push(f)
  }
  return acc
}

let adminPw = ''
try {
  adminPw = (readFileSync('.env.local', 'utf8').match(/^ADMIN_PASSWORD=(.+)$/m)?.[1] ?? '').trim()
} catch {}

if (adminPw.length < 8) {
  console.log(dim('  ○ لم تُضبط كلمة المرور — تخطّي فحص الحزمة'))
} else {
  try {
    const hits = walkAll('.next/static').filter((f) => readFileSync(f, 'utf8').includes(adminPw))
    if (hits.length === 0) {
      console.log(ok('قيمتها لا توجد في أي ملف من حزمة المتصفح المبنيّة'))
    } else {
      failed++
      console.log(no('قيمة كلمة المرور موجودة في حزمة المتصفح:'))
      for (const h of hits) console.log(dim(`  ${h}`))
    }
  } catch {
    console.log(dim('  ○ لا توجد حزمة مبنيّة بعد — شغّل next build ثم أعِد الفحص'))
  }
}

// ---------- مفاتيح ملصوقة حرفياً ----------
console.log('\n── إضافي · مفتاح ملصوق في الكود ' + '─'.repeat(28))
const LITERAL = /(eyJ[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{20,})/
const hardcoded = files.filter((f) => LITERAL.test(f.src))
if (hardcoded.length === 0) {
  console.log(ok('لا مفتاح مكتوباً حرفياً — كلها من متغيّرات البيئة'))
} else {
  failed++
  console.log(no('مفتاح ملصوق في:'))
  for (const f of hardcoded) console.log(dim(`  ${f.rel}`))
}

console.log('\n' + '═'.repeat(60))
if (failed === 0) {
  console.log('\x1b[32mلا تسرّب.\x1b[0m\n')
  process.exit(0)
} else {
  console.log(`\x1b[31mأخفق ${failed} فحصاً.\x1b[0m\n`)
  process.exit(1)
}
