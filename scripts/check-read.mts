/**
 * فحص طبقة القراءة — المرحلة ٢.
 *
 *   npm run check:read
 *
 * يستدعي كل دالّة جلب على البيانات الحقيقية ويطبع مخرجها،
 * ويتحقّق من ثلاث قواعد لا يكفي فيها النظر إلى الكود:
 *
 *   ٦.١ · الحالة تأتي من v_lectures ولا تُحسب في الواجهة
 *   ٦.٦ · الشيخ غير النشط يخرج من القائمة وتبقى لقاءاته في «السابقة»
 *   ٦.٧ · اللقاء الملغى يبقى ظاهراً، وفي الوعاء الصحيح بحسب موعده
 */

// تُحمَّل البيئة قبل استيراد الوحدات، لأن عميل Supabase يقرأها لحظة تحميله
process.loadEnvFile('.env.local')

const {
  getSettings,
  getSheikhs,
  getSheikhBySlug,
  getSeriesBySlug,
  getSeriesSlugMap,
  getLectures,
  getFeaturedLecture,
  getLecturesBySeriesId,
  seriesProgress,
} = await import('../lib/queries')

const { hijriDate, weekday, timeOfDay, countdown, arNum, TYPE_LABEL, STATUS_LABEL, dayKey } =
  await import('../lib/datetime')

const ok = (s: string) => `\x1b[32m✔\x1b[0m ${s}`
const no = (s: string) => `\x1b[31m✘\x1b[0m ${s}`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const head = (s: string) => `\n\x1b[1m── ${s} \x1b[0m${'─'.repeat(Math.max(0, 56 - s.length))}`

let failed = 0
const expect = (cond: boolean, msg: string) => {
  if (cond) console.log(ok(msg))
  else {
    failed++
    console.log(no(msg))
  }
}

// ---------- الإعدادات ----------
console.log(head('الإعدادات'))
const settings = await getSettings()
console.log(ok(`المقر: ${settings.hq_place}`))
console.log(dim(`  خرائط: ${settings.hq_map_url ?? '—'}`))
console.log(dim(`  الشعار: ${settings.logo_url ?? 'لم يُرفع بعد'}`))

// ---------- المشايخ ----------
console.log(head('المشايخ · القاعدة ٦.٦'))
const active = await getSheikhs(true)
const all = await getSheikhs(false)
console.log(dim(`  النشطون: ${active.map((s) => s.name).join(' · ')}`))
console.log(dim(`  الكل    : ${all.length}`))
expect(active.length === 2 && all.length === 3, 'الشيخ غير النشط يخرج من القائمة الافتراضية')

const inactive = all.find((s) => !s.is_active)!
console.log(dim(`  غير النشط: ${inactive.name} (${inactive.slug})`))

const missing = await getSheikhBySlug('la-yujad-abadan')
expect(missing === null, 'رابط شيخ غير موجود يعيد null — لتعرض ٤٠٤ (المعيار ١٠)')

// ---------- اللقاءات: الوعاءان ----------
console.log(head('اللقاءات · الوعاءان'))
const upcoming = await getLectures({ period: 'upcoming' })
const past = await getLectures({ period: 'past' })
const every = await getLectures()

console.log(dim(`  القادمة: ${upcoming.length} · السابقة: ${past.length} · الكل: ${every.length}`))
expect(upcoming.length + past.length === every.length, 'الوعاءان يستوعبان كل اللقاءات بلا تكرار')

const upSorted = upcoming.every(
  (l, i) => i === 0 || new Date(upcoming[i - 1].starts_at) <= new Date(l.starts_at)
)
const pastSorted = past.every(
  (l, i) => i === 0 || new Date(past[i - 1].starts_at) >= new Date(l.starts_at)
)
expect(upSorted, 'القادمة مرتّبة بالأقرب زمناً')
expect(pastSorted, 'السابقة مرتّبة بالأحدث أولاً')

// ---------- القاعدة ٦.٧ · الملغى ----------
console.log(head('اللقاء الملغى · القاعدة ٦.٧'))
const cancelled = every.filter((l) => l.status === 'cancelled')
expect(cancelled.length === 1, `اللقاء الملغى ظاهر ولم يُحذف (${cancelled.length})`)
const c = cancelled[0]
console.log(dim(`  ${c.title} — الترتيب ${arNum(c.ord)} — ${hijriDate(c.starts_at)}`))
expect(
  upcoming.some((l) => l.id === c.id),
  'الملغى القادم يقع في وعاء «القادمة» لا «السابقة»'
)

// ---------- القاعدة ٦.٦ · لقاء الشيخ غير النشط ----------
console.log(head('لقاءات الشيخ غير النشط'))
const hisLectures = every.filter((l) => l.sheikh_slug === inactive.slug)
expect(hisLectures.length > 0, `لقاءاته باقية ظاهرة (${hisLectures.length})`)
expect(
  hisLectures.every((l) => past.some((p) => p.id === l.id)),
  'وكلها في «السابقة»'
)

// ---------- الوراثة ----------
console.log(head('الوراثة · لقاء ← سلسلة ← إعدادات'))
const overridden = every.filter((l) => l.place !== settings.hq_place)
expect(overridden.length === 1, `لقاء واحد بمكان خاص (${overridden.length})`)
console.log(dim(`  ${overridden[0]?.place}`))
const inherited = every.filter((l) => l.place === settings.hq_place)
expect(inherited.length === 14, `و${inherited.length} لقاءً يرث مقر الجمعية`)

const longer = every.filter((l) => l.duration_min !== 90 && l.duration_min !== 60 && l.duration_min !== 75)
console.log(dim(`  مدد متجاوِزة عن سلسلتها: ${longer.map((l) => l.duration_min).join(', ') || '—'}`))

// ---------- شريط البطل ----------
console.log(head('شريط البطل'))
const featured = await getFeaturedLecture()
if (!featured) {
  console.log(dim('  لا لقاءات قادمة حالياً — الشريط يعرض الحالة الفارغة'))
} else {
  const cd = countdown(featured.starts_at)
  console.log(ok(`${STATUS_LABEL[featured.status]} — ${featured.title}`))
  console.log(dim(`  ${featured.sheikh_name}`))
  console.log(dim(`  ${weekday(featured.starts_at)} ${hijriDate(featured.starts_at)} · ${timeOfDay(featured.starts_at)}`))
  console.log(
    dim(
      `  يبقى: ${cd.soon ? `${arNum(cd.hours)}:${arNum(cd.minutes)} ساعة` : `${arNum(cd.days)} يوم`}`
    )
  )
  expect(
    featured.status === 'live' || featured.status === 'upcoming',
    'البطل لا يعرض ملغى ولا منتهياً'
  )
}

// ---------- السلسلة ----------
console.log(head('صفحة السلسلة · المعيار ٩'))
const series = await getSeriesBySlug('bulugh-almaram')
expect(series !== null, 'السلسلة موجودة بـ slug')
if (series) {
  const its = await getLecturesBySeriesId(series.id)
  const { done, total } = seriesProgress(its)
  console.log(ok(`${series.title} — أُنجز ${arNum(done)} من ${arNum(total)}`))
  expect(done === 3 && total === 6, 'شريط التقدّم يعطي ٣ من ٦')
  const ordsOk = its.every((l, i) => l.ord === i + 1)
  expect(ordsOk, 'الترتيب متسلسل من ١ بلا فجوات')
  console.log(
    dim(
      '  ' +
        its.map((l) => `${arNum(l.ord)}:${STATUS_LABEL[l.status]}`).join(' · ')
    )
  )
}

const noSeries = await getSeriesBySlug('la-yujad-abadan')
expect(noSeries === null, 'رابط سلسلة غير موجود يعيد null')

// ---------- خريطة روابط السلاسل ----------
console.log(head('ربط اللقاء بصفحة سلسلته'))
const slugMap = await getSeriesSlugMap()
expect(slugMap.size === 5, `خريطة السلاسل فيها ${slugMap.size} سلسلة`)
const unmapped = every.filter((l) => !slugMap.has(l.series_id))
expect(unmapped.length === 0, 'كل لقاء يجد رابط سلسلته')

// ---------- التصفية ----------
console.log(head('التصفية · الثلاث المسموحة'))
const bySheikh = await getLectures({ sheikhSlug: 'abdullah-almohammed' })
expect(bySheikh.length === 9, `تصفية بالشيخ: ${bySheikh.length} لقاءً`)
const byType = await getLectures({ type: 'remote' })
expect(byType.length === 4, `تصفية بالنوع «عن بُعد»: ${byType.length} لقاءات`)
const none = await getLectures({ sheikhSlug: 'abdullah-almohammed', type: 'onsite' })
console.log(
  none.length === 0
    ? ok('تصفية لا تطابق شيئاً تعيد صفراً — تعرض الصفحة رسالتها')
    : dim(`  تصفية مركّبة: ${none.length}`)
)

// ---------- التقويم ----------
console.log(head('التقويم · مطابقة اليوم'))
const days = new Map<string, number>()
for (const l of every) days.set(dayKey(l.starts_at), (days.get(dayKey(l.starts_at)) ?? 0) + 1)
expect(days.size > 0, `${days.size} يوماً فيه لقاء`)
console.log(dim(`  أمثلة: ${[...days.entries()].slice(0, 4).map(([k, n]) => `${k}=${n}`).join(' · ')}`))

// ---------- عيّنة صفّ ----------
console.log(head('عيّنة صفّ كما سيظهر'))
const sample = upcoming[0]
if (sample) {
  const cd = countdown(sample.starts_at)
  console.log(dim(`  الترتيب : ${arNum(sample.ord)}`))
  console.log(dim(`  اللقاء  : ${sample.title}${sample.book ? ` — ${sample.book}` : ''}`))
  console.log(dim(`  الشيخ   : ${sample.sheikh_name}`))
  console.log(dim(`  الموعد  : ${hijriDate(sample.starts_at)} · ${weekday(sample.starts_at)} · ${timeOfDay(sample.starts_at)} · ${arNum(sample.duration_min)} د`))
  console.log(dim(`  النوع   : ${TYPE_LABEL[sample.type]}`))
  console.log(dim(`  الوجهة  : ${sample.type !== 'remote' ? sample.place : ''}${sample.join_url ? ' + رابط دخول' : ''}`))
  console.log(dim(`  العدّاد : ${cd.soon ? `${arNum(cd.hours)}:${arNum(cd.minutes)}` : `${arNum(cd.days)} يوم`}`))
  console.log(dim(`  الحالة  : ${STATUS_LABEL[sample.status]}`))
}

console.log('\n' + '═'.repeat(60))
if (failed === 0) console.log('\x1b[32mطبقة القراءة سليمة — كل التوقّعات تحقّقت.\x1b[0m\n')
else console.log(`\x1b[31mأخفق ${failed} توقّعاً.\x1b[0m\n`)
process.exitCode = failed === 0 ? 0 : 1
