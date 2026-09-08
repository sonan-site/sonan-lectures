-- =============================================================
-- هجرة ٠٠٣ · الشيخ يتناوب داخل اللقاء + حقلا المقدار (ADR-0005)
-- منصة اللقاءات العلمية · جمعية سنن
--
-- كشفها أول استيراد حقيقي: خطة "شرح الجمع بين الصحيحين، المجلد الأول"
-- — ١٩ لقاءً يتناوب عليها ١٣ شيخاً، ولكل لقاء مقدار (من باب — إلى باب)
-- يخصّه. النموذج افترض شيخاً واحداً ثابتاً لكل سلسلة (ADR-0001) — والثابت
-- الحقيقي هو الكتاب والعنوان وحدهما.
--
-- الشيخ يصير حقلاً موروثاً قابلاً للتجاوز، بنفس نمط duration_min/type/
-- place/join_url تماماً: NULL على اللقاء يعني "يرث السلسلة". ويصير
-- اختيارياً على الطرفين معاً — سلسلة كل لقاء فيها بشيخ مختلف لا شيخ
-- افتراضي لها — مع حارسين يضمنان وجوده في أحدهما دائماً.
--
-- راجعتها عملية مستقلة بصرامة مطابقة لمراجعة هجرة ٠٠٢، ووجدت ٨ ملاحظات
-- حقيقية مُدمَجة هنا (أبرزها: جسر التوافق والحارس في دالّة واحدة لا
-- دالّتين، لأن ترتيب تنفيذ مُشغِّلين منفصلين على الحدث نفسه أبجديّ لا
-- منطقي؛ وحارس معاكس على السلسلة يمنع تفريغ شيخها الافتراضي بصمت وهي
-- تحمل لقاءات تعتمد على وراثته).
--
-- لا نافذة انكسار توافقي: لا مسار كود حالي يكتب حقول الشيخ الجديدة أو
-- يفترض غيابها، فتعمل المنصة الحالية بلا أي تعديل كود فور تشغيل هذه
-- الهجرة.
-- =============================================================


-- =============================================================
-- ٠ · فحص قبليّ — شغّل هذا القسم وحده أولاً، وتوقّف إن أعاد الفحص
--     الثالث رقماً غير صفر
-- =============================================================

select conname, confdeltype from pg_constraint
 where conrelid = 'lectures'::regclass and contype = 'f';
-- المتوقَّع: lectures_series_id_fkey · confdeltype = 'c' (cascade)

select conname, confdeltype from pg_constraint
 where conrelid = 'series'::regclass and contype = 'f';
-- المتوقَّع: series_sheikh_id_fkey · confdeltype = 'n' (set null)

select count(*) from series where sheikh_name is null or sheikh_slug is null;
-- المتوقَّع: ٠ — إن ظهر غير ذلك فثمّة خلل سابق مستقلّ عن هذه الهجرة، توقّف

select count(*) from information_schema.columns
 where table_name = 'lectures'
   and column_name in ('sheikh_id','sheikh_name','sheikh_slug','scope_from','scope_to');
-- المتوقَّع: ٠ — لا تصادم أسماء

select (select count(*) from series) as series_n, (select count(*) from lectures) as lectures_n;
-- احتفظ بهذا الرقم للمقارنة بعد التنفيذ


-- =============================================================
-- ١ · المعاملة الكاملة
-- =============================================================

begin;

-- ── ١) اللقاء: عمودا المقدار — بلا وراثة ولا قيد ──────────────
alter table lectures
  add column if not exists scope_from text,
  add column if not exists scope_to   text;


-- ── ٢) السلسلة: الشيخ يصير اختيارياً على مستواها أيضاً ────────
-- تعديل تجويفي بحت (يُزيل قيداً، لا يضيفه). لا صفّ قائم يخالفه — كل
-- سلسلة اليوم تحمل sheikh_name/sheikh_slug منذ هجرة ٠٠٢ (الفحص القبلي).
-- وقيد الصيغة القائم series_sheikh_slug_format لا يحتاج تعديلاً: قيود
-- CHECK في PostgreSQL تُعامل NULL نجاحاً تلقائياً لا فشلاً.

alter table series
  alter column sheikh_name drop not null,
  alter column sheikh_slug drop not null;


-- ── ٣) اللقاء: شيخ مُتجاوِز — يطابق نمط duration_min/type/place/
--     join_url تماماً ────────────────────────────────────────

alter table lectures
  add column if not exists sheikh_id uuid
    constraint lectures_sheikh_id_fkey references sheikhs (id) on delete set null,
  add column if not exists sheikh_name text,
  add column if not exists sheikh_slug text,
  add constraint lectures_sheikh_slug_format
    check (sheikh_slug is null or sheikh_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- يخدم SET NULL عند حذف قالب (يفحص كل مرجع إليه)، ويخدم عدّاد تأكيد
-- حذف الشيخ في اللوحة لاحقاً — يطابق سابقة series_sheikh_idx
create index if not exists lectures_sheikh_idx on lectures (sheikh_id);


-- ── ٤) جسر التوافق + الحارس على اللقاء — دالّة واحدة لا دالّتان ─
--
-- ⚠️ لو انفصلا في مُشغِّلين BEFORE منفصلين على lectures، لصار ترتيب
-- تنفيذهما معتمداً على الترتيب الأبجدي لاسمَي المُشغِّلين — قاعدة
-- PostgreSQL موثَّقة، لا افتراضاً. لو نُفِّذ الحارس قبل الجسر خطأً، لرُفض
-- إدخالٌ صالحٌ يحمل sheikh_id فقط بلا لقطة اسم بعد.

create or replace function lectures_sheikh_guard() returns trigger
language plpgsql as $$
declare
  v_series_sheikh_name text;
begin
  -- أ) الجسر: يملأ لقطة اللقاء تلقائياً إن أُعطي مرجعاً بلا لقطة معه
  if new.sheikh_id is not null and (new.sheikh_name is null or new.sheikh_slug is null) then
    select sh.name, sh.slug into new.sheikh_name, new.sheikh_slug
      from sheikhs sh where sh.id = new.sheikh_id;
  end if;

  -- ب) الحارس: لقاء بلا لقطة اسم على نفسه يلزمه شيخ افتراضي على سلسلته.
  --    الفحص على sheikh_name لا sheikh_id: مرجعٌ محذوف (SET NULL) يُبقي
  --    لقطة الاسم صالحة، وهذا لا يعني غياب شيخ.
  if new.sheikh_name is null then
    select s.sheikh_name into v_series_sheikh_name
      from series s where s.id = new.series_id;
    if v_series_sheikh_name is null then
      raise exception 'لا شيخ فعّال لهذا اللقاء — لا لقطة عليه ولا شيخ افتراضي لسلسلته.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists lectures_sheikh_guard_trg on lectures;
create trigger lectures_sheikh_guard_trg
  before insert or update on lectures
  for each row execute function lectures_sheikh_guard();


-- ── ٥) الحارس المعاكس على السلسلة ──────────────────────────────
--
-- الحارس أعلاه يحرس اتجاهاً واحداً: إدخال/تعديل لقاء. لا شيء يمنع
-- تعديل السلسلة نفسها لاحقاً بتفريغ شيخها الافتراضي — فتترك لقاءات
-- تعتمد على وراثته يتيمة بصمت. لا مسار كود حالي يفعل هذا (الكتابة
-- الوحيدة على series اليوم هي أرشفة/استرجاع)، فهذا احتياط مجاني لا
-- يمسّ شيئاً يعمل الآن، يمنع ثغرة مستقبلية.

create or replace function series_sheikh_guard() returns trigger
language plpgsql as $$
declare
  v_orphans int;
begin
  if new.sheikh_name is null and old.sheikh_name is not null then
    select count(*) into v_orphans
      from lectures l where l.series_id = new.id and l.sheikh_name is null;
    if v_orphans > 0 then
      raise exception '% لقاءً في هذه السلسلة بلا لقطة شيخ خاصة به، يعتمد على وراثة شيخها الافتراضي — عيّن شيخاً مباشراً لكل واحد منها قبل تفريغ شيخ السلسلة.', v_orphans
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists series_sheikh_guard_trg on series;
create trigger series_sheikh_guard_trg
  before update on series
  for each row execute function series_sheikh_guard();


-- ── ٦) إعادة بناء العرضين — الأعمدة القائمة بالاسم والنوع والترتيب
--     نفسها، والجديد يُلحَق في الآخر فقط ──────────────────────
--
-- ⚠️ إن رفض PostgreSQL رغم ذلك: استبدل التعريفين بـ DROP VIEW ثم
--    CREATE VIEW لكليهما (v_lectures أولاً، فهو المعتمِد)، ثم أعد
--    GRANT SELECT على v_lectures_admin — DROP لا يحفظ المنح تلقائياً
--    خلاف CREATE OR REPLACE.

create or replace view v_lectures_admin as
select
  l.id,
  l.series_id,
  coalesce(l.sheikh_id, s.sheikh_id)         as sheikh_id,
  coalesce(l.sheikh_name, s.sheikh_name)     as sheikh_name,
  coalesce(l.sheikh_slug, s.sheikh_slug)     as sheikh_slug,
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
  s.archived_at                              as series_archived_at,
  l.scope_from,
  l.scope_to
from lectures l
join series  s  on s.id = l.series_id
cross join settings cfg;

grant select on v_lectures_admin to anon, authenticated;

create or replace view v_lectures as
select
  id, series_id, sheikh_id, sheikh_name, sheikh_slug,
  title, book, ord, series_count, starts_at, duration_min, ends_at,
  type, place, map_url, join_url, is_cancelled, status,
  scope_from, scope_to
from v_lectures_admin
where lecture_archived_at is null
  and series_archived_at  is null;

-- admin_delete_lecture لا يُعاد تعريفها: لا تلمس أعمدة الشيخ ولا
-- النطاق، ومروراها يعدّلان ord فقط لصفوف series_id واحد.

commit;


-- =============================================================
-- ٢ · تحقّق — شغّله وانسخ المخرج كاملاً
-- =============================================================

select البند, القيمة, المتوقع
from (
  select 1 as ت, 'أعمدة الشيخ على اللقاء'::text as البند,
         (select count(*)::text from information_schema.columns
           where table_name = 'lectures' and column_name in ('sheikh_id','sheikh_name','sheikh_slug')),
         '3'::text as المتوقع
  union all select 2, 'عمودا المقدار',
         (select count(*)::text from information_schema.columns
           where table_name = 'lectures' and column_name in ('scope_from','scope_to')), '2'
  union all select 3, 'sheikh_name/slug على السلسلة صارا اختياريين',
         (select count(*)::text from information_schema.columns
           where table_name = 'series' and column_name in ('sheikh_name','sheikh_slug') and is_nullable = 'YES'), '2'
  union all select 4, 'قيد lectures_sheikh_id_fkey ⇐ set null',
         (select confdeltype::text from pg_constraint where conname = 'lectures_sheikh_id_fkey'), 'n'
  union all select 5, 'فهرس lectures_sheikh_idx',
         (select count(*)::text from pg_indexes where indexname = 'lectures_sheikh_idx'), '1'
  union all select 6, 'مُشغِّل الحارس على اللقاء',
         (select count(*)::text from pg_trigger where tgname = 'lectures_sheikh_guard_trg'), '1'
  union all select 7, 'مُشغِّل الحارس على السلسلة',
         (select count(*)::text from pg_trigger where tgname = 'series_sheikh_guard_trg'), '1'
  union all select 8, 'أعمدة العرض الإداري',
         (select count(*)::text from information_schema.columns where table_name = 'v_lectures_admin'), '22'
  union all select 9, 'أعمدة العرض العام',
         (select count(*)::text from information_schema.columns where table_name = 'v_lectures'), '20'
  union all select 10, 'كل صفوف v_lectures لها شيخ فعّال',
         (select count(*)::text from v_lectures where sheikh_name is null or sheikh_slug is null), '0'
  union all select 11, 'دالّة الحذف — بلا تغيير',
         (select count(*)::text from pg_proc where proname = 'admin_delete_lecture'), '1'
  union all select 12, 'إجمالي السلاسل بلا فقد',
         (select count(*)::text from series), 'قارن بالفحص القبلي'
  union all select 13, 'إجمالي اللقاءات بلا فقد',
         (select count(*)::text from lectures), 'قارن بالفحص القبلي'
  union all select 14, 'لقاءات فيها تجاوز شيخ الآن',
         (select count(*)::text from lectures where sheikh_name is not null),
         '٠ الآن — يصير > ٠ بعد استيراد السلسلة الدوّارة'
  union all select 15, 'مثال حيّ: الوراثة تعمل على لقاء قائم',
         (select v.sheikh_name || ' = ' || s.sheikh_name from v_lectures_admin v
           join series s on s.id = v.series_id
           join lectures l on l.id = v.id
           where l.sheikh_name is null limit 1),
         'الطرفان متطابقان نصّاً'
) x
order by ت;
