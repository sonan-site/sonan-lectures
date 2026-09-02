-- =============================================================
-- منصة اللقاءات العلمية · جمعية سنن
-- مخطط قاعدة البيانات — Supabase / PostgreSQL
-- مشتقّ من DECISIONS-SUMMARY.md و ADR 0001–0003
-- =============================================================

-- ------------------------------------------------------------
-- 0) الأنواع
-- ------------------------------------------------------------
-- نوع اللقاء: ثلاث قيم محسومة (السؤال ٥)
create type lecture_type as enum ('onsite', 'remote', 'hybrid');
-- onsite = حضوري · remote = عن بُعد · hybrid = حضوري وعن بُعد


-- ------------------------------------------------------------
-- 1) الإعدادات — صف واحد فقط
--    «مصدر واحد للقيم المكرّرة»: المقر يُعرَّف هنا لا في كل لقاء
-- ------------------------------------------------------------
create table settings (
  id            boolean primary key default true,
  hq_place      text not null default 'مقر جمعية سنن',
  hq_map_url    text,
  updated_at    timestamptz not null default now(),
  constraint settings_singleton check (id)   -- يمنع وجود أكثر من صف
);

insert into settings (hq_place, hq_map_url)
values ('مقر جمعية سنن', 'https://maps.google.com/?q=...');


-- ------------------------------------------------------------
-- 2) المشايخ
--    كيان مستقل لأن عليه تُبنى صفحة الشيخ والتصفية (السؤال ٢٠)
-- ------------------------------------------------------------
create table sheikhs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,          -- /sheikh/<slug>
  is_active   boolean not null default true, -- الإخفاء بدل الحذف (السؤال ٢٣)
  created_at  timestamptz not null default now(),
  constraint sheikhs_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index sheikhs_active_idx on sheikhs (is_active) where is_active;


-- ------------------------------------------------------------
-- 3) السلاسل — وعاء الإدخال، لا تُعرض للزائر (ADR-0001)
--    تحمل القيم الافتراضية التي يرثها كل لقاء
-- ------------------------------------------------------------
create table series (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,                 -- عنوان اللقاء
  book          text,                          -- نصّ حرّ، لا كيان (السؤال ٢١)
  sheikh_id     uuid not null references sheikhs (id) on delete restrict,
  type          lecture_type not null,
  place         text,                          -- فارغ ⇐ يُستخدم مقر الجمعية
  map_url       text,
  join_url      text,                          -- رابط الدخول
  duration_min  smallint not null default 90,  -- (السؤال ٧)
  created_at    timestamptz not null default now(),

  constraint series_duration_range check (duration_min between 5 and 600),
  -- لقاء غير حضوري بحت يلزمه رابط دخول
  constraint series_link_required check (type = 'onsite' or join_url is not null)
);

create index series_sheikh_idx on series (sheikh_id);


-- ------------------------------------------------------------
-- 4) اللقاءات — وحدة العرض في الجدول والتقويم
--    الحقول الاختيارية هنا = تجاوز للقيمة الموروثة من السلسلة
-- ------------------------------------------------------------
create table lectures (
  id            uuid primary key default gen_random_uuid(),
  series_id     uuid not null references series (id) on delete cascade,
  ord           smallint not null,             -- الترتيب ضمن السلسلة، يبدأ من ١
  starts_at     timestamptz not null,          -- مُخزَّن UTC · مُدخَل ومعروض بتوقيت الرياض

  -- تجاوزات اللقاء المفرد (فارغة ⇐ يرث السلسلة)
  duration_min  smallint,
  type          lecture_type,
  place         text,
  map_url       text,
  join_url      text,

  is_cancelled  boolean not null default false, -- الإلغاء لا الحذف (السؤال ١٤)
  created_at    timestamptz not null default now(),

  constraint lectures_ord_positive  check (ord >= 1),
  constraint lectures_duration_range check (duration_min is null
                                            or duration_min between 5 and 600),
  constraint lectures_ord_unique     unique (series_id, ord)
);

create index lectures_starts_idx on lectures (starts_at);


-- ------------------------------------------------------------
-- 5) العرض الموحّد — كل ما تحتاجه الواجهة في استعلام واحد
--    يحسم الوراثة (لقاء ← سلسلة ← إعدادات) ويشتقّ الحالة
-- ------------------------------------------------------------
create view v_lectures as
select
  l.id,
  l.series_id,
  s.sheikh_id,
  sh.name                                   as sheikh_name,
  sh.slug                                   as sheikh_slug,
  s.title,
  s.book,
  l.ord,
  (select count(*) from lectures x where x.series_id = s.id) as series_count,
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
  end                                        as status
from lectures l
join series  s  on s.id = l.series_id
join sheikhs sh on sh.id = s.sheikh_id
cross join settings cfg;


-- ------------------------------------------------------------
-- 6) الصلاحيات
--    القراءة عامة بلا تسجيل دخول · الكتابة من الخادم وحده
--    (كلمة مرور واحدة ⇐ لا مستخدم Supabase ⇐ الكتابة بمفتاح الخدمة)
-- ------------------------------------------------------------
alter table sheikhs  enable row level security;
alter table series   enable row level security;
alter table lectures enable row level security;
alter table settings enable row level security;

create policy public_read_sheikhs  on sheikhs  for select to anon, authenticated using (true);
create policy public_read_series   on series   for select to anon, authenticated using (true);
create policy public_read_lectures on lectures for select to anon, authenticated using (true);
create policy public_read_settings on settings for select to anon, authenticated using (true);

-- لا سياسات إدخال/تعديل/حذف: كل كتابة تمرّ عبر Next.js Route Handler
-- يتحقّق من كلمة المرور ثم يستخدم service_role key.


-- ------------------------------------------------------------
-- تعديل لاحق: رابط صفحة السلسلة (السؤال ٢٦)
-- ------------------------------------------------------------
alter table series
  add column slug text not null unique,
  add constraint series_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
-- /s/<slug> — يُقترح تلقائياً من العنوان ويُعدَّل يدوياً، ولا يُغيَّر بعد نشره.


-- ------------------------------------------------------------
-- تعديل لاحق: شعار الجمعية يُرفع من اللوحة (السؤال ٢٨)
-- ------------------------------------------------------------
alter table settings add column logo_url text;

-- مخزن الملفات — للشعار وحده. أي توسعة لاحقة (صور مشايخ، أغلفة) بقرار مستقل.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- القراءة عامة (الشعار يظهر لكل زائر)
create policy branding_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'branding');

-- لا سياسة كتابة: الرفع يمرّ عبر Route Handler يفحص كوكي المشرف
-- ثم يستخدم service_role — كما في ADR-0004.


-- ------------------------------------------------------------
-- تعديل لاحق: النموذج القالبي والأرشفة (هجرة ٠٠٢ و٠٠٢-ب)
--
-- قائمة المشايخ صارت قائمة **قوالب**: اسم الشيخ ورابطه يُنسخان لقطةً
-- داخل السلسلة عند إنشائها، فحذف القالب لا يمسّ سلسلة ولا لقاءً ولا
-- حتى الرابط العام `/sheikh/<slug>` — طالما بقيت له سلسلة.
--
-- والأرشفة إخفاءٌ قابل للاسترجاع، بديلٌ للحذف النهائي حين لا يُراد
-- محو التاريخ بل إخفاؤه فقط عن الزائر.
-- ------------------------------------------------------------

-- اللقطة: تُنسخ عند الإنشاء، ولا تُقرأ من جدول sheikhs بعدها
alter table series
  add column sheikh_name text,
  add column sheikh_slug text;

update series s set sheikh_name = sh.name, sheikh_slug = sh.slug
  from sheikhs sh where sh.id = s.sheikh_id;

alter table series
  alter column sheikh_name set not null,
  alter column sheikh_slug set not null,
  add constraint series_sheikh_slug_format check (sheikh_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- المرجع يبقى للربط، لا لمنع الحذف: حذف القالب يُفرّغه ولا يمسّ اللقطة
alter table series
  drop constraint series_sheikh_id_fkey,
  alter column sheikh_id drop not null,
  add constraint series_sheikh_id_fkey
      foreign key (sheikh_id) references sheikhs (id) on delete set null;

-- جسر توافق: يملأ اللقطة تلقائياً في أي إدخال مباشر لا يحملها
create or replace function series_fill_sheikh_copy() returns trigger
language plpgsql as $$
begin
  if new.sheikh_name is null or new.sheikh_slug is null then
    select sh.name, sh.slug into new.sheikh_name, new.sheikh_slug
      from sheikhs sh where sh.id = new.sheikh_id;
  end if;
  return new;
end $$;

create trigger series_fill_sheikh_copy_trg
  before insert on series
  for each row execute function series_fill_sheikh_copy();

-- الأرشفة: إخفاء قابل للاسترجاع، على السلسلة وعلى اللقاء كليهما
alter table series   add column archived_at timestamptz;
alter table lectures add column archived_at timestamptz;

create index series_live_idx   on series   (archived_at) where archived_at is null;
create index lectures_live_idx on lectures (archived_at) where archived_at is null;

-- v_lectures يُعاد بناؤه: يقرأ اللقطة (لا join على sheikhs)، ويُخفي المؤرشف
create or replace view v_lectures as
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
  end                                        as status
from lectures l
join series  s  on s.id = l.series_id
cross join settings cfg
where l.archived_at is null
  and s.archived_at is null;

-- v_lectures_admin: العرض نفسه بلا ترشيح — تقرأ منه اللوحة وحدها،
-- فلا تسقط حالة لقاء مؤرشف إلى «قادم» (القاعدة ٦.١)
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

-- حذف لقاء + إعادة ترقيم ذرّية بمرورين — يحفظ الترتيب القائم بلا فجوة
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

  perform 1 from series where id = v_series for update;

  select max(ord) into v_max from lectures where series_id = v_series;
  if v_max > 30000 then
    raise exception 'ord_window_exhausted' using errcode = '22003';
  end if;

  delete from lectures where id = p_lecture_id;

  update lectures set ord = ord + 1000
   where lectures.series_id = v_series and lectures.ord > v_ord;
  update lectures set ord = ord - 1001
   where lectures.series_id = v_series and lectures.ord > 1000;

  return query
    select v_series, count(*)::int from lectures l where l.series_id = v_series;
end $$;

revoke all on function admin_delete_lecture(uuid) from public, anon, authenticated;
grant execute on function admin_delete_lecture(uuid) to service_role;

-- تنفيذ هذا القسم فعلياً في docs/migration-002-template-and-archive.sql
-- و docs/migration-002b-missing-pieces.sql — هذا القسم مرجع مطابق للحالة
-- النهائية، لا يُشغَّل بذاته.
