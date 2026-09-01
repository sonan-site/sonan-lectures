-- =============================================================
-- هجرة ٠٠٢ · النموذج القالبي + الأرشفة + إتاحة الحذف
-- منصة اللقاءات العلمية · جمعية سنن
--
-- تُشغَّل **مرة واحدة**، **كتلةً واحدة** في Supabase ← SQL Editor.
-- (لا سطراً سطراً: `begin`/`commit` لا يعملان حينئذ.)
--
-- كلها داخل معاملة واحدة. وPostgreSQL معاملاتُه شاملة لتعديل البنية،
-- فأي فشل — في الحارس، أو في اسم القيد، أو في أعمدة العرض — يُسقط
-- المعاملة كاملةً وتعود القاعدة إلى حالها بلا أثر.
--
-- ⚠️ تُعدّل بيانات قائمة ومنشورة. أذِن بها صاحب المشروع بعد قراءة الخطة
--    (توقّف إجباري · القسم ١١).
--
-- ⚠️ لو انقطع الاتصال أثناء التنفيذ فقد تبقى معاملة معلّقة تحمل قفلاً
--    على `series` فتتجمّد قراءات الموقع. علاجها:
--      select pg_terminate_backend(pid) from pg_stat_activity
--       where state = 'idle in transaction';
--
-- ما تنقضه بإذن صريح:
--   · القسم ٥  — «لا زرّ حذف إطلاقاً» في تبويب المشايخ
--   · القاعدة ٦.٦ — «الشيخ لا يُحذف»
--   · ADR-0001  — الشيخ كيان مرجعي لا نصّ
-- =============================================================


-- ═════════════════════════════════════════════════════════════
-- ٠ · فحص قبليّ — شغّل هذه الأربعة **وحدها أولاً** وأرسل مخرجها
-- ═════════════════════════════════════════════════════════════
--
-- ١) اسم القيد الأجنبي الحقيقي (الخطوة ٥ تعتمد عليه)
--    المتوقّع: series_sheikh_id_fkey
-- select conname from pg_constraint
--  where conrelid = 'series'::regclass and contype = 'f';
--
-- ٢) لا سلسلة يتيمة — يجب أن يعود 0
-- select count(*) from series s
--   left join sheikhs sh on sh.id = s.sheikh_id where sh.id is null;
--
-- ٣) لا شيء يعتمد على العرض غير نفسه — يجب ألّا يعود صفّ
-- select dependent.relname from pg_depend d
--   join pg_rewrite r on r.oid = d.objid
--   join pg_class dependent on dependent.oid = r.ev_class
--  where d.refobjid = 'v_lectures'::regclass and dependent.relname <> 'v_lectures';
--
-- ٤) صورة أعمدة العرض — احتفظ بها للمقارنة بعد التنفيذ
-- select ordinal_position, column_name, data_type
--   from information_schema.columns where table_name = 'v_lectures' order by 1;


begin;

-- ═════════════════════════════════════════════════════════════
-- ١ · لقطة الشيخ داخل السلسلة  (النموذج القالبي)
-- ═════════════════════════════════════════════════════════════

alter table series add column if not exists sheikh_name text;
alter table series add column if not exists sheikh_slug text;

-- نسخ القيم القائمة — لا يضيع صفّ واحد
update series s
   set sheikh_name = sh.name,
       sheikh_slug = sh.slug
  from sheikhs sh
 where sh.id = s.sheikh_id;

-- حارس: لا يُشدَّد القيد قبل التأكّد أن كل صفّ امتلأ
do $$
declare n int;
begin
  select count(*) into n from series where sheikh_name is null or sheikh_slug is null;
  if n > 0 then
    raise exception 'الهجرة أُوقفت: % سلسلة بلا لقطة اسم الشيخ. لم يُنفَّذ شيء.', n;
  end if;
end $$;

alter table series
  alter column sheikh_name set not null,
  alter column sheikh_slug set not null,
  add constraint series_sheikh_slug_format
      check (sheikh_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- القيد الأجنبي: restrict ← set null
-- حذف الشيخ يُفرّغ المرجع، واللقطة (الاسم والرابط) تبقى في السلسلة.
alter table series
  drop constraint series_sheikh_id_fkey,
  alter column sheikh_id drop not null,
  add constraint series_sheikh_id_fkey
      foreign key (sheikh_id) references sheikhs (id) on delete set null;


-- ═════════════════════════════════════════════════════════════
-- ٢ · جسر التوافق — يُبقي الكود المنشور عاملاً
-- ═════════════════════════════════════════════════════════════
--
-- ⚠️ بدون هذا المُشغِّل تنكسر المنصة بين لحظتين: بعد تشغيل الهجرة وقبل
--    نشر الكود الجديد. لأن `POST /api/admin/series` المنشور الآن يُدخل
--    سلسلة بلا العمودين الجديدين وهما `not null` — فيفشل كل إنشاء.
--
-- ويبقى بعد النشر عمداً: أي إدخال مباشر في `series` (من محرّر Supabase
-- مثلاً) يملأ اللقطة تلقائياً بدل أن يفشل.

create or replace function series_fill_sheikh_copy() returns trigger
language plpgsql as $$
begin
  if new.sheikh_name is null or new.sheikh_slug is null then
    select sh.name, sh.slug into new.sheikh_name, new.sheikh_slug
      from sheikhs sh where sh.id = new.sheikh_id;
  end if;
  return new;
end $$;

drop trigger if exists series_fill_sheikh_copy_trg on series;
create trigger series_fill_sheikh_copy_trg
  before insert on series
  for each row execute function series_fill_sheikh_copy();


-- ═════════════════════════════════════════════════════════════
-- ٣ · الأرشفة  (حذف ناعم قابل للاسترجاع)
-- ═════════════════════════════════════════════════════════════
--
-- `archived_at` فارغ = حيّ · غير فارغ = مؤرشف ومخفيّ عن الزائر.
-- وهو غير `is_cancelled`: الملغى يبقى ظاهراً مشطوباً (القاعدة ٦.٧)،
-- والمؤرشف يختفي تماماً.

alter table series   add column if not exists archived_at timestamptz;
alter table lectures add column if not exists archived_at timestamptz;

create index if not exists series_live_idx   on series   (archived_at) where archived_at is null;
create index if not exists lectures_live_idx on lectures (archived_at) where archived_at is null;


-- ═════════════════════════════════════════════════════════════
-- ٤ · العرض الإداري — كل شيء بلا ترشيح
-- ═════════════════════════════════════════════════════════════
--
-- ⚠️ لازم للقاعدة ٦.١: لو قرأت اللوحة العرضَ العام (الذي يُخفي المؤرشف)
--    لفقدت لقاءات السلاسل المؤرشفة حالتَها وسقطت افتراضاً إلى «قادم» —
--    فيعرض المشرف ماضياً على أنه قادم.
--
-- ولا يكشف هذا العرض شيئاً جديداً: سياسات `public_read_series` و
-- `public_read_lectures` في المخطط تمنح قراءة عامة على الجدولين الخامين
-- أصلاً. الأرشفة **إخفاءٌ من العرض لا سرّية**.

create or replace view v_lectures_admin as
select
  l.id,
  l.series_id,
  s.sheikh_id,
  s.sheikh_name,
  s.sheikh_slug,
  s.title,
  s.book,
  l.ord,
  (select count(*) from lectures x
    where x.series_id = s.id and x.archived_at is null) as series_count,
  l.starts_at,
  coalesce(l.duration_min, s.duration_min)   as duration_min,
  l.starts_at
    + make_interval(mins => coalesce(l.duration_min, s.duration_min)) as ends_at,
  coalesce(l.type, s.type)                   as type,
  coalesce(l.place, s.place, cfg.hq_place)   as place,
  coalesce(l.map_url, s.map_url, cfg.hq_map_url) as map_url,
  coalesce(l.join_url, s.join_url)           as join_url,
  l.is_cancelled,
  case
    when l.is_cancelled then 'cancelled'
    when now() <  l.starts_at then 'upcoming'
    when now() <  l.starts_at
         + make_interval(mins => coalesce(l.duration_min, s.duration_min)) then 'live'
    else 'done'
  end                                        as status,
  l.archived_at                              as lecture_archived_at,
  s.archived_at                              as series_archived_at
from lectures l
join series  s  on s.id = l.series_id
cross join settings cfg;

grant select on v_lectures_admin to anon, authenticated;


-- ═════════════════════════════════════════════════════════════
-- ٥ · العرض العام — الأعمدة الثمانية عشر نفسها بالترتيب نفسه
-- ═════════════════════════════════════════════════════════════
--
-- ⚠️ `create or replace view` يشترط بقاء أسماء الأعمدة وأنواعها وترتيبها.
--    الثمانية عشر محفوظة. وإن رفض رغم ذلك، استبدل السطر التالي بـ:
--      drop view v_lectures;  create view v_lectures as ...
--    (آمن داخل المعاملة، والفحص القبلي ٣ يُثبت أن لا شيء يعتمد عليه.)

create or replace view v_lectures as
select
  id, series_id, sheikh_id, sheikh_name, sheikh_slug,
  title, book, ord, series_count, starts_at, duration_min, ends_at,
  type, place, map_url, join_url, is_cancelled, status
from v_lectures_admin
where lecture_archived_at is null
  and series_archived_at  is null;


-- ═════════════════════════════════════════════════════════════
-- ٦ · حذف لقاء + إعادة ترقيم ذرّية
-- ═════════════════════════════════════════════════════════════
--
-- القيد `lectures_ord_unique (series_id, ord)` غير مؤجَّل، فأي إعادة
-- ترقيم بمرور واحد تصطدم بصفٍّ قائم. المروران يحلّانها بلا تعديل القيد.
--
-- ⚠️ يُحفظ الترتيب القائم كما هو ولا يُعاد حسابه بالتاريخ: لقاءٌ أُجِّل
--    قد يكون ترتيبه غير زمني عمداً، فإعادة الترقيم بالتاريخ تُبدّل ترتيب
--    المشرف من تلقائها.

create or replace function admin_delete_lecture(p_lecture_id uuid)
returns table (out_series_id uuid, out_remaining integer)
language plpgsql
as $$
declare
  v_series uuid;
  v_ord    smallint;
  v_max    smallint;
begin
  select l.series_id, l.ord into v_series, v_ord
    from lectures l where l.id = p_lecture_id;

  if v_series is null then
    raise exception 'lecture_not_found' using errcode = 'P0002';
  end if;

  -- قفل السلسلة: يمنع تشابك حذفين متزامنين على الترتيب نفسه
  perform 1 from series where id = v_series for update;

  select max(ord) into v_max from lectures where series_id = v_series;
  if v_max > 30000 then
    raise exception 'ord_window_exhausted' using errcode = '22003';
  end if;

  delete from lectures where id = p_lecture_id;

  -- المرور ١: نقل ما بعده إلى نافذة عالية معزولة
  update lectures set ord = ord + 1000
   where lectures.series_id = v_series and lectures.ord > v_ord;

  -- المرور ٢: الإنزال إلى الموضع الصحيح
  update lectures set ord = ord - 1001
   where lectures.series_id = v_series and lectures.ord > 1000;

  return query
    select v_series, count(*)::int from lectures l where l.series_id = v_series;
end $$;

-- الكتابة بمفتاح الخدمة وحده بعد `requireAdmin()` (القاعدة ٦.٥)
revoke all on function admin_delete_lecture(uuid) from public, anon, authenticated;
grant execute on function admin_delete_lecture(uuid) to service_role;

commit;


-- =============================================================
-- تحقّق بعد التشغيل — شغّله وانسخ المخرج
-- =============================================================

select البند, القيمة, المتوقع
from (
  select 1 as ت, 'سلاسل بلقطة اسم'::text as البند,
         (select count(*) from series where sheikh_name is not null)::text as القيمة,
         (select count(*) from series)::text as المتوقع
  union all select 2, 'اللقطة تطابق جدول المشايخ',
         (select count(*) from series s join sheikhs sh on sh.id = s.sheikh_id
           where s.sheikh_name = sh.name and s.sheikh_slug = sh.slug)::text,
         (select count(*) from series where sheikh_id is not null)::text
  union all select 3, 'قيد الشيخ صار set null',
         (select confdeltype::text from pg_constraint where conname = 'series_sheikh_id_fkey'), 'n'
  union all select 4, 'مُشغِّل جسر التوافق',
         (select count(*)::text from pg_trigger where tgname = 'series_fill_sheikh_copy_trg'), '1'
  union all select 5, 'أعمدة الأرشفة',
         (select count(*)::text from information_schema.columns
           where column_name = 'archived_at' and table_name in ('series','lectures')), '2'
  union all select 6, 'العرض الإداري',
         (select count(*)::text from information_schema.views where table_name = 'v_lectures_admin'), '1'
  union all select 7, 'أعمدة العرض العام',
         (select count(*)::text from information_schema.columns where table_name = 'v_lectures'), '18'
  union all select 8, 'صفوف العرض (لا مؤرشف بعد)',
         (select count(*)::text from v_lectures), (select count(*)::text from lectures)
  union all select 9, 'المعيار ١ يعمل',
         (select count(*)::text from v_lectures where status = 'live'), 'رقم بلا خطأ'
  union all select 10, 'دالّة الحذف',
         (select count(*)::text from pg_proc where proname = 'admin_delete_lecture'), '1'
) x
order by ت;
