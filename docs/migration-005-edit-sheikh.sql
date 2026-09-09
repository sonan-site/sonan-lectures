-- =============================================================
-- هجرة ٠٠٥ — تعديل اسم الشيخ ورابطه (بخيار التطبيق الرجعي)
-- منصة اللقاءات العلمية · جمعية سنن
--
-- دالّة واحدة فقط، بنمط admin_delete_lecture تماماً: تحديث القالب
-- (sheikhs) دائماً، وتحديث لقطتَي السلسلة واللقاء معاً — أو لا شيء
-- منهما — حسب p_apply_existing، داخل معاملة واحدة ذرّية. لا عمود
-- جديد ولا قيد جديد؛ الأعمدة كلها موجودة أصلاً منذ هجرتَي ٠٠٢ و٠٠٣.
-- =============================================================

-- فحص قبلي — شغّله وحده أولاً
select proname from pg_proc where proname = 'admin_edit_sheikh';
-- المتوقَّع: صفّ واحد فارغ (لا نتائج) — الدالّة غير موجودة بعد.
-- لو أعادت صفاً، فالهجرة نُفِّذت سابقاً؛ توقّف ولا تكمل.

begin;

create or replace function admin_edit_sheikh(
  p_sheikh_id uuid,
  p_name text,
  p_slug text,
  p_apply_existing boolean
) returns void
language plpgsql as $$
begin
  update sheikhs set name = p_name, slug = p_slug where id = p_sheikh_id;

  if not found then
    raise exception 'sheikh_not_found' using errcode = 'P0002';
  end if;

  if p_apply_existing then
    update series   set sheikh_name = p_name, sheikh_slug = p_slug where sheikh_id = p_sheikh_id;
    update lectures set sheikh_name = p_name, sheikh_slug = p_slug where sheikh_id = p_sheikh_id;
  end if;
end $$;

revoke all on function admin_edit_sheikh(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function admin_edit_sheikh(uuid, text, text, boolean) to service_role;

commit;


-- =============================================================
-- تحقّق بعد التنفيذ — شغّله وأرسل لي المخرجات
-- =============================================================

-- ١) الدالّة موجودة وصلاحياتها صحيحة (يجب أن تعيد صفّاً واحداً: service_role فقط)
select grantee from information_schema.routine_privileges
 where routine_name = 'admin_edit_sheikh';

-- ٢) اختَر شيخاً حقيقياً له سلسلة أو لقاء متجاوِز لتجربة الحالتين يدوياً
--    من لوحة التحكم بعد التنفيذ (لا حاجة لتجربتهما بـSQL مباشرة):
--    · تعديل بلا "طبّق على القائم" ⇐ القالب يتغيّر، ولقطات series/lectures تبقى كما كانت.
--    · تعديل مع "طبّق على القائم" ⇐ القالب ولقطات series/lectures الثلاثة تتحدّث معاً.
