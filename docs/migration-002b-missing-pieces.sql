-- =============================================================
-- هجرة ٠٠٢-ب · تكملة ما لم يُنفَّذ من هجرة ٠٠٢
-- منصة اللقاءات العلمية · جمعية سنن
--
-- شُغِّلت النسخة الأولى من الهجرة، وأنجزت:
--   ✔ لقطة الشيخ في السلسلة   ✔ القيد set null   ✔ عمودا الأرشفة
--   ✔ العرض v_lectures يقرأ اللقطة ويُخفي المؤرشف
--
-- وبقيت ثلاثة أجزاء، هذا الملف يضيفها. **إضافية بالكامل — لا تمسّ صفّاً**.
--
-- 🔴 عاجل: الجزء ١ يُصلح عطلاً قائماً الآن — إنشاء السلسلة من اللوحة
--    يفشل، لأن الكود المنشور لا يكتب عمودَي اللقطة وهما not null.
--
-- تُشغَّل كتلةً واحدة في Supabase ← SQL Editor.
-- =============================================================

begin;

-- ═════════════════════════════════════════════════════════════
-- ١ · جسر التوافق  🔴 يُصلح عطلاً قائماً
-- ═════════════════════════════════════════════════════════════
--
-- يملأ لقطة الشيخ تلقائياً في أي إدخال لا يحملها. فيعمل الكود المنشور
-- الآن كما كان، ويبقى بعد نشر الكود الجديد حارساً لأي إدخال مباشر من
-- محرّر Supabase.

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
-- ٢ · العرض الإداري — كل شيء بلا ترشيح
-- ═════════════════════════════════════════════════════════════
--
-- لازم للقاعدة ٦.١: العرض العام صار يُخفي المؤرشف، فلو قرأته اللوحة
-- لفقدت لقاءات السلاسل المؤرشفة حالتَها وسقطت افتراضاً إلى «قادم» —
-- فيرى المشرف ماضياً على أنه قادم.
--
-- ولا يكشف شيئاً جديداً: سياسات public_read_series و public_read_lectures
-- تمنح قراءة عامة على الجدولين الخامين أصلاً. الأرشفة إخفاءٌ لا سرّية.

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
-- ٣ · حذف لقاء + إعادة ترقيم ذرّية
-- ═════════════════════════════════════════════════════════════
--
-- القيد lectures_ord_unique (series_id, ord) غير مؤجَّل، فأي إعادة ترقيم
-- بمرور واحد تصطدم بصفٍّ قائم. المروران يحلّانها بلا تعديل القيد.
--
-- ⚠️ يُحفظ الترتيب القائم ولا يُعاد حسابه بالتاريخ: لقاءٌ أُجِّل قد يكون
--    ترتيبه غير زمني عمداً، فإعادة الترقيم بالتاريخ تُبدّل ترتيب المشرف.

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

-- الكتابة بمفتاح الخدمة وحده بعد requireAdmin() (القاعدة ٦.٥)
revoke all on function admin_delete_lecture(uuid) from public, anon, authenticated;
grant execute on function admin_delete_lecture(uuid) to service_role;

commit;


-- =============================================================
-- تحقّق — شغّله وانسخ المخرج
-- =============================================================

select البند, القيمة, المتوقع
from (
  select 1 as ت, 'مُشغِّل جسر التوافق'::text as البند,
         (select count(*)::text from pg_trigger
           where tgname = 'series_fill_sheikh_copy_trg') as القيمة,
         '1'::text as المتوقع
  union all select 2, 'العرض الإداري',
         (select count(*)::text from information_schema.views
           where table_name = 'v_lectures_admin'), '1'
  union all select 3, 'دالّة حذف اللقاء',
         (select count(*)::text from pg_proc where proname = 'admin_delete_lecture'), '1'
  union all select 4, 'العرض العام ثمانية عشر عموداً',
         (select count(*)::text from information_schema.columns
           where table_name = 'v_lectures'), '18'
  union all select 5, 'العرض الإداري يرى كل اللقاءات',
         (select count(*)::text from v_lectures_admin),
         (select count(*)::text from lectures)
  union all select 6, 'العرض العام = اللقاءات الحيّة',
         (select count(*)::text from v_lectures),
         (select count(*)::text from lectures where archived_at is null)
) x
order by ت;
