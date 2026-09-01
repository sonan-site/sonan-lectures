-- =============================================================
-- بيانات تجريبية — منصة اللقاءات العلمية · جمعية سنن
-- ملف مستقل. لا علاقة له بـ schema.sql ولا يُدمج فيه.
-- غرضه الوحيد: إثبات معايير القبول الاثني عشر (القسم ٩) على بيانات حقيقية.
-- يُحذف بالكامل قبل النشر — أمر الحذف في آخر الملف.
--
-- كل التواريخ محسوبة من now() بإزاحة بالأيام، لا تواريخ ثابتة،
-- فتبقى الحالات الأربع صحيحة مهما تأخّر تشغيل الملف.
--
-- لا يمسّ هذا الملف جدول settings إطلاقاً.
-- =============================================================


-- ------------------------------------------------------------
-- حارس: يمنع الزرع مرتين
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from series where slug = 'bulugh-almaram') then
    raise exception 'البيانات التجريبية مزروعة سلفاً. شغّل أمر الحذف في آخر الملف ثم أعد المحاولة.';
  end if;
end $$;


-- ------------------------------------------------------------
-- ١) المشايخ — ثلاثة، أحدهم غير نشط
-- ------------------------------------------------------------
insert into sheikhs (name, slug, is_active) values
  ('الشيخ عبدالله المحمد', 'abdullah-almohammed', true),
  ('الشيخ سليمان الفهد',   'sulaiman-alfahd',     true),
  ('الشيخ أحمد الناصر',    'ahmed-alnasser',      false);   -- غير نشط (القاعدة ٦.٦)


-- ------------------------------------------------------------
-- ٢) السلاسل — خمس
-- ------------------------------------------------------------
insert into series (title, book, sheikh_id, type, join_url, duration_min, slug)
select 'شرح بلوغ المرام', 'بلوغ المرام من أدلة الأحكام', id,
       'hybrid', 'https://meet.google.com/sonan-bulugh', 90, 'bulugh-almaram'
from sheikhs where slug = 'abdullah-almohammed';

insert into series (title, book, sheikh_id, type, duration_min, slug)
select 'شرح عمدة الأحكام', 'عمدة الأحكام للمقدسي', id,
       'onsite', 90, 'omdat-alahkam'
from sheikhs where slug = 'sulaiman-alfahd';

insert into series (title, book, sheikh_id, type, join_url, duration_min, slug)
select 'الجمع بين الصحيحين', 'الجمع بين الصحيحين للحميدي', id,
       'remote', 'https://meet.google.com/sonan-sahihain', 60, 'aljam-bayn-alsahihayn'
from sheikhs where slug = 'abdullah-almohammed';

-- سلسلة من لقاء واحد، شيخها غير نشط ولقاؤه ماضٍ
-- (تُثبت: الشيخ غير النشط يخرج من التصفية وتبقى لقاءاته في «السابقة»)
insert into series (title, sheikh_id, type, join_url, duration_min, slug)
select 'منهج طالب العلم في الطلب', id,
       'remote', 'https://meet.google.com/sonan-manhaj', 75, 'manhaj-talib-alilm'
from sheikhs where slug = 'ahmed-alnasser';

-- سلسلة من لقاء واحد قادم — تُثبت ظهور الترتيب «١» في اللقاء المنفرد
insert into series (title, sheikh_id, type, duration_min, slug)
select 'آداب طالب العلم', id, 'onsite', 60, 'adab-talib-alilm'
from sheikhs where slug = 'sulaiman-alfahd';


-- ------------------------------------------------------------
-- ٣) اللقاءات
--     صيغة الموعد: منتصف ليل اليوم بتوقيت الرياض + إزاحة أيام + ساعة
-- ------------------------------------------------------------

-- --- بلوغ المرام: ٦ لقاءات أسبوعية · ٣ منتهية و٣ قادمة (٨:٠٠ مساءً)
insert into lectures (series_id, ord, starts_at)
select s.id, v.ord,
       (date_trunc('day', now() at time zone 'Asia/Riyadh')
        + make_interval(days => v.d, hours => 20)) at time zone 'Asia/Riyadh'
from series s, (values (1,-21),(2,-14),(3,-7),(4,7),(5,14),(6,21)) as v(ord, d)
where s.slug = 'bulugh-almaram';

-- --- عمدة الأحكام: ٤ لقاءات (٥:٣٠ مساءً)
insert into lectures (series_id, ord, starts_at)
select s.id, v.ord,
       (date_trunc('day', now() at time zone 'Asia/Riyadh')
        + make_interval(days => v.d, hours => 17, mins => 30)) at time zone 'Asia/Riyadh'
from series s, (values (1,-10),(3,5)) as v(ord, d)
where s.slug = 'omdat-alahkam';

-- اللقاء الجارٍ الآن: بدأ قبل ربع ساعة · مدّة متجاوِزة ١٨٠ بدل ٩٠
-- (يُثبت status='live' ووسم «مختلف عن السلسلة» في اللوحة)
insert into lectures (series_id, ord, starts_at, duration_min)
select s.id, 2, now() - interval '15 minutes', 180
from series s where s.slug = 'omdat-alahkam';

-- لقاء بمكان مختلف عن المقر (يُثبت الوراثة بالتجاوز لا بالنسخ)
insert into lectures (series_id, ord, starts_at, place, map_url)
select s.id, 4,
       (date_trunc('day', now() at time zone 'Asia/Riyadh')
        + make_interval(days => 12, hours => 17, mins => 30)) at time zone 'Asia/Riyadh',
       'جامع الملك خالد — بريدة',
       'https://maps.google.com/?q=King+Khalid+Mosque+Buraydah'
from series s where s.slug = 'omdat-alahkam';

-- --- الجمع بين الصحيحين: ٣ لقاءات (٩:٣٠ مساءً)
insert into lectures (series_id, ord, starts_at)
select s.id, v.ord,
       (date_trunc('day', now() at time zone 'Asia/Riyadh')
        + make_interval(days => v.d, hours => 21, mins => 30)) at time zone 'Asia/Riyadh'
from series s, (values (1,-3),(3,11)) as v(ord, d)
where s.slug = 'aljam-bayn-alsahihayn';

-- اللقاء الملغى: قادمٌ وملغى — يبقى ظاهراً مشطوباً وعدّاده متوقّف (القاعدة ٦.٧)
insert into lectures (series_id, ord, starts_at, is_cancelled)
select s.id, 2,
       (date_trunc('day', now() at time zone 'Asia/Riyadh')
        + make_interval(days => 4, hours => 21, mins => 30)) at time zone 'Asia/Riyadh',
       true
from series s where s.slug = 'aljam-bayn-alsahihayn';

-- --- منهج طالب العلم: لقاء واحد ماضٍ لشيخ غير نشط (٧:٠٠ مساءً)
insert into lectures (series_id, ord, starts_at)
select s.id, 1,
       (date_trunc('day', now() at time zone 'Asia/Riyadh')
        + make_interval(days => -5, hours => 19)) at time zone 'Asia/Riyadh'
from series s where s.slug = 'manhaj-talib-alilm';

-- --- آداب طالب العلم: لقاء واحد قادم (٥:٠٠ مساءً)
insert into lectures (series_id, ord, starts_at)
select s.id, 1,
       (date_trunc('day', now() at time zone 'Asia/Riyadh')
        + make_interval(days => 2, hours => 17)) at time zone 'Asia/Riyadh'
from series s where s.slug = 'adab-talib-alilm';


-- =============================================================
-- تحقّق بعد الزرع — شغّلها وانسخ المخرجات
-- =============================================================

-- فحص ٤.٣ · يجب أن تظهر الحالات الأربع كلها
--   select status, count(*) from v_lectures group by 1 order by 1;
--   المتوقّع: cancelled=1 · done=6 · live=1 · upcoming=7   (المجموع ١٥)

-- معيار القبول ١ · يجب أن يعود ١
--   select count(*) from v_lectures where status = 'live';

-- معيار القبول ٩ · سلسلة فيها منتهٍ ⇐ صفحتها تعرض «أُنجز ٣ من ٦»
--   select ord, status from v_lectures
--   where series_id = (select id from series where slug='bulugh-almaram') order by ord;

-- الوراثة تعمل: المقر موروث من settings، والمكان المختلف متجاوِز
--   select ord, place, duration_min, type from v_lectures
--   where series_id = (select id from series where slug='omdat-alahkam') order by ord;


-- =============================================================
-- أمر الحذف — انسخ ما بين النجمتين وحده وشغّله قبل النشر
-- يمسح المشايخ والسلاسل واللقاءات التجريبية كلها. لا يمسّ settings.
--
-- ⚠️ حُدِّث بعد هجرة ٠٠٢: كان الحارس يعتمد على قيد `on delete restrict`
--    الذي صار `on delete set null`. فلو تُرك كما كان، لمرّ الأمر صامتاً
--    وأيتم سلاسلك الحقيقية بدل أن يرفض. الحارس الآن صريح في الشرط.
-- =============================================================

/*
with removed as (
  delete from series
   where slug in ('bulugh-almaram','omdat-alahkam','aljam-bayn-alsahihayn',
                  'manhaj-talib-alilm','adab-talib-alilm')
  returning sheikh_id
)
delete from sheikhs
 where slug in ('abdullah-almohammed','sulaiman-alfahd','ahmed-alnasser')
   and id in (select sheikh_id from removed where sheikh_id is not null)
   -- الحارس: لا يُحذف شيخ بقيت له سلسلة حقيقية أنشأتَها أنت
   and not exists (select 1 from series s where s.sheikh_id = sheikhs.id);
*/

-- اللقاءات تُحذف تلقائياً مع سلاسلها (on delete cascade — الأثر الجانبي ٨.٢).
-- وبعد هجرة ٠٠٢ صار حذف الشيخ لا يمسّ سلاسله أصلاً (اللقطة محفوظة فيها)،
-- فالحارس أعلاه احتياطٌ ليبقى الأمر مقصوراً على البيانات التجريبية وحدها.
