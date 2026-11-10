-- Funksiya huquqlarini qattiqlashtirish (Supabase Security Advisors 0028 / 0029).
-- security definer funksiyalar /rest/v1/rpc/... orqali ochiq bo'lmasligi kerak:
--   * anon hech qaysi public funksiyani chaqira olmaydi;
--   * authenticated faqat 4 ta funksiyani chaqira oladi (RLS siyosatlari va RPC uchun kerak);
--   * can_view va rls_auto_enable ichki: faqat boshqa security definer funksiyalar / event trigger ishlatadi.

-- ===== 1. Barcha public funksiyalardan PUBLIC, anon (va authenticated) huquqini olish =====
revoke execute on all functions in schema public from public, anon, authenticated;

-- ===== 2. authenticated ga kerakli funksiyalarni qayta berish =====
-- is_teacher, can_access_course, can_access_resource: RLS siyosatlari chaqiruvchi huquqi bilan chaqiradi.
-- list_visible_students: frontend RPC.
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.list_visible_students() to authenticated;
grant execute on function public.can_access_course(uuid, uuid) to authenticated;
grant execute on function public.can_access_resource(uuid, uuid) to authenticated;

-- ===== 3. can_view va rls_auto_enable: authenticated ham chaqira olmaydi =====
-- (1-bandda olingan; shu yerda niyat aniq ko'rinishi uchun alohida yozildi.)
-- can_view faqat list_visible_students ichidan (egasi huquqi bilan) chaqiriladi.
revoke execute on function public.can_view(uuid, uuid, public.privacy_item) from public, anon, authenticated;
-- rls_auto_enable Supabase "Automatic RLS" event trigger funksiyasi (platforma yaratadi, lokalda bo'lmasligi mumkin).
-- Event trigger funksiyasi ishga tushganda EXECUTE tekshirilmaydi, shuning uchun bu avtomatik RLS ni buzmaydi.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- ===== 4. can_access_course / can_access_resource ichiga qo'riqchi =====
-- Tizimga kirgan chaqiruvchi faqat o'zi nomidan so'raydi (o'qituvchi bundan mustasno):
-- boshqa o'quvchining guruhi/kursini uid berib aniqlab bo'lmaydi.
-- auth.uid() null (postgres/service_role, ichki chaqiruvlar) bo'lsa cheklov yo'q (can_view dagidek).
create or replace function public.can_access_course(uid uuid, cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null
         and can_access_course.uid is distinct from (select auth.uid())
         and not public.is_teacher()
      then false
    else exists (
      select 1
        from public.group_courses gc
       where gc.group_id = public.active_group_id(can_access_course.uid)
         and gc.course_id = can_access_course.cid
    )
  end;
$$;

create or replace function public.can_access_resource(uid uuid, rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null
         and can_access_resource.uid is distinct from (select auth.uid())
         and not public.is_teacher()
      then false
    else exists (
      select 1
        from public.resources r
        join public.topics t on t.id = r.topic_id
       where r.id = can_access_resource.rid
         and public.can_access_course(can_access_resource.uid, t.course_id)
         and (
           not exists (select 1 from public.resource_groups rg where rg.resource_id = r.id)
           or exists (
             select 1
               from public.resource_groups rg
              where rg.resource_id = r.id
                and rg.group_id = public.active_group_id(can_access_resource.uid)
           )
         )
    )
  end;
$$;

-- create or replace huquqlarni saqlaydi; baribir aniq qayta belgilaymiz.
revoke execute on function public.can_access_course(uuid, uuid) from public, anon;
revoke execute on function public.can_access_resource(uuid, uuid) from public, anon;
grant execute on function public.can_access_course(uuid, uuid) to authenticated;
grant execute on function public.can_access_resource(uuid, uuid) to authenticated;

-- ===== 5. Kelajakdagi funksiyalar anon ga standart ochilmasin =====
-- Supabase postgres/supabase_admin uchun public sxemasida anon, authenticated, service_role ga
-- avtomatik EXECUTE beradi; PostgreSQL esa har bir funksiyaga PUBLIC EXECUTE beradi.
-- Kerakli funksiyaga grant ni migratsiyada aniq yozing.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;
