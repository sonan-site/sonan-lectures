-- =============================================================
-- استعلام تحقّق واحد — منصة اللقاءات العلمية
-- يُشغَّل بعد schema.sql و seed.sql. يعيد جدولاً واحداً بكل ما يلزم.
-- يقرأ ولا يكتب. آمن للتشغيل في أي وقت.
-- =============================================================

select البند, القيمة, المتوقع
from (
  -- فحص ٤.٣ · الحالات الأربع مشتقّة من v_lectures
  select 1 as ت, 'حالة · upcoming'::text as البند,
         (select count(*) from v_lectures where status = 'upcoming')::text as القيمة,
         '7'::text as المتوقع
  union all select 2, 'حالة · live',
         (select count(*) from v_lectures where status = 'live')::text, '1'
  union all select 3, 'حالة · done',
         (select count(*) from v_lectures where status = 'done')::text, '6'
  union all select 4, 'حالة · cancelled',
         (select count(*) from v_lectures where status = 'cancelled')::text, '1'

  -- سلامة الزرع
  union all select 5, 'مجموع اللقاءات',
         (select count(*) from lectures)::text, '15'
  union all select 6, 'المشايخ',
         (select count(*) from sheikhs)::text, '3'
  union all select 7, 'السلاسل',
         (select count(*) from series)::text, '5'
  union all select 8, 'صف الإعدادات',
         (select count(*) from settings)::text, '1'

  -- تغطية الحالات الخاصة المطلوبة
  union all select 9, 'شيخ غير نشط',
         (select count(*) from sheikhs where not is_active)::text, '1'
  union all select 10, 'سلسلة من لقاء واحد',
         (select count(*) from (select series_id from lectures
                                group by series_id having count(*) = 1) z)::text, '2'
  union all select 11, 'لقاء بمكان متجاوِز',
         (select count(*) from lectures where place is not null)::text, '1'
  union all select 12, 'لقاء بمدة متجاوِزة',
         (select count(*) from lectures where duration_min is not null)::text, '1'

  -- الوراثة: المقر يأتي من settings لا من اللقاء
  union all select 13, 'لقاءات ترث مقر الجمعية',
         (select count(*) from v_lectures
          where place = (select hq_place from settings))::text, '14'

  -- سياسات RLS: قراءة للجميع، ولا كتابة لأحد
  union all select 14, 'سياسات SELECT عامة',
         (select count(*) from pg_policies where schemaname = 'public'
          and cmd = 'SELECT')::text, '4'
  union all select 15, 'سياسات كتابة (يجب أن تكون صفراً)',
         (select count(*) from pg_policies where schemaname = 'public'
          and cmd <> 'SELECT')::text, '0'

  -- معيار القبول ٩ · سلسلة فيها منتهٍ ⇐ صفحتها تعرض «أُنجز ٣ من ٦»
  union all select 16, 'بلوغ المرام · المنتهي من الإجمالي',
         (select count(*) filter (where status = 'done') || ' من ' || count(*)
          from v_lectures where series_id =
            (select id from series where slug = 'bulugh-almaram')), '3 من 6'
) x
order by ت;
