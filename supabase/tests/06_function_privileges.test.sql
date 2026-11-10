begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- ===== Tayyorlov (postgres sifatida) =====
insert into public.groups (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'A guruh'),
  ('00000000-0000-0000-0000-00000000000b', 'B guruh');

select set_config('test.t', tests.create_user('ustoz', 'teacher')::text, true);
select set_config('test.a1',
  tests.create_user('a1_user', 'student', '00000000-0000-0000-0000-00000000000a')::text, true);
select set_config('test.b1',
  tests.create_user('b1_user', 'student', '00000000-0000-0000-0000-00000000000b')::text, true);

insert into public.courses (id, title) values ('00000000-0000-0000-0000-0000000000c1', 'CS');
insert into public.group_courses (group_id, course_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1');
insert into public.topics (id, course_id, title, position) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'T1', 0);
-- e1: hamma guruhga ochiq; e2: faqat A guruhga
insert into public.resources (id, topic_id, type, title, url, body_md) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'link', 'r_open', 'https://example.com', null),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1', 'note', 'r_a', null, '# salom');
insert into public.resource_groups (resource_id, group_id) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000a');

-- ===== 1-2. Huquqlar jadvali =====
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon public sxemasidagi hech qaysi funksiyani chaqira olmaydi'
);
select set_eq(
  $$ select p.proname::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind in ('f', 'p')
        and has_function_privilege('authenticated', p.oid, 'execute') $$,
  array['is_teacher', 'list_visible_students', 'can_access_course', 'can_access_resource'],
  'authenticated aynan 4 ta funksiyani chaqira oladi'
);

-- ===== 3-4. Ichki funksiyalar =====
select ok(
  not has_function_privilege('authenticated', 'public.can_view(uuid, uuid, public.privacy_item)', 'execute')
  and not has_function_privilege('anon', 'public.can_view(uuid, uuid, public.privacy_item)', 'execute'),
  'can_view: authenticated ham, anon ham chaqira olmaydi'
);
select ok(
  to_regprocedure('public.rls_auto_enable()') is not null
  and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')
  and not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute'),
  'rls_auto_enable: authenticated ham, anon ham chaqira olmaydi'
);

-- ===== 5-6. Kelajakdagi funksiyalar standart bo'yicha yopiq =====
create function public.zz_future_fn() returns int language sql as 'select 1';
select ok(
  not has_function_privilege('anon', 'public.zz_future_fn()', 'execute'),
  'yangi public funksiya anon ga standart ochiq emas'
);
select ok(
  not exists (
    select 1
      from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.oid = 'public.zz_future_fn()'::regprocedure
       and a.grantee = 0   -- 0 = PUBLIC
  ),
  'yangi public funksiya PUBLIC ga ham standart ochiq emas'
);

-- ===== 7-9. To'g'ridan-to'g'ri chaqiruv rad etiladi =====
select set_config('role', 'anon', true);
select throws_ok(
  $$ select public.is_teacher() $$,
  '42501', null, 'anon is_teacher() ni chaqira olmaydi'
);
select tests.authenticate_as(current_setting('test.a1')::uuid);
select throws_ok(
  $$ select public.can_view(current_setting('test.a1')::uuid, current_setting('test.b1')::uuid, 'avatar') $$,
  '42501', null, 'authenticated can_view ni chaqira olmaydi'
);
select throws_ok(
  $$ select public.rls_auto_enable() $$,
  '42501', null, 'authenticated rls_auto_enable() ni chaqira olmaydi'
);

-- ===== 10-13. Qo'riqchi: o'quvchi faqat o'z nomidan so'raydi (a1 sifatida) =====
select is(
  public.can_access_course(current_setting('test.b1')::uuid, '00000000-0000-0000-0000-0000000000c1'),
  false, 'a1: b1 nomidan can_access_course false (b1 uchun haqiqatda true bo''lardi)'
);
select is(
  public.can_access_course(current_setting('test.a1')::uuid, '00000000-0000-0000-0000-0000000000c1'),
  true, 'a1: o''z nomidan can_access_course true'
);
select is(
  public.can_access_resource(current_setting('test.b1')::uuid, '00000000-0000-0000-0000-0000000000e1'),
  false, 'a1: b1 nomidan can_access_resource false (b1 uchun haqiqatda true bo''lardi)'
);
select is(
  public.can_access_resource(current_setting('test.a1')::uuid, '00000000-0000-0000-0000-0000000000e1'),
  true, 'a1: o''z nomidan can_access_resource true'
);

-- ===== 14-16. O'qituvchi boshqa uid uchun hisoblay oladi =====
select tests.authenticate_as(current_setting('test.t')::uuid);
select is(
  public.can_access_course(current_setting('test.a1')::uuid, '00000000-0000-0000-0000-0000000000c1'),
  true, 'o''qituvchi: a1 uchun can_access_course haqiqiy qiymat (true)'
);
select is(
  public.can_access_resource(current_setting('test.b1')::uuid, '00000000-0000-0000-0000-0000000000e1'),
  true, 'o''qituvchi: b1 uchun can_access_resource haqiqiy qiymat (true)'
);
select is(
  public.can_access_resource(current_setting('test.b1')::uuid, '00000000-0000-0000-0000-0000000000e2'),
  false, 'o''qituvchi: b1 uchun r_a haqiqiy qiymat (false, guruh ro''yxatida emas)'
);

-- ===== 17. Ichki chaqiruv (auth.uid() null) cheklanmaydi =====
select tests.clear_auth();
select is(
  public.can_access_course(current_setting('test.a1')::uuid, '00000000-0000-0000-0000-0000000000c1'),
  true, 'postgres/service (auth.uid() null): can_access_course cheklanmaydi'
);

-- ===== 18. "Automatic RLS" hamon ishlaydi =====
create table public.zz_rls_probe (id int);
select is(
  (select relrowsecurity from pg_class where oid = 'public.zz_rls_probe'::regclass),
  true, 'yangi public jadvalda RLS avtomatik yoqiladi (rls_auto_enable event trigger)'
);

select * from finish();
rollback;
