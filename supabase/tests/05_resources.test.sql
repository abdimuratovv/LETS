begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- ===== Tayyorlov (postgres sifatida) =====
insert into public.groups (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'A guruh'),
  ('00000000-0000-0000-0000-00000000000b', 'B guruh');

select set_config('test.t', tests.create_user('ustoz', 'teacher')::text, true);
select set_config('test.a1',
  tests.create_user('a1_user', 'student', '00000000-0000-0000-0000-00000000000a')::text, true);
select set_config('test.b1',
  tests.create_user('b1_user', 'student', '00000000-0000-0000-0000-00000000000b')::text, true);

insert into public.courses (id, title) values
  ('00000000-0000-0000-0000-0000000000c1', 'CS'),
  ('00000000-0000-0000-0000-0000000000c2', 'FE');
-- A va B ikkalasi CS ga biriktirilgan; FE hech kimga
insert into public.group_courses (group_id, course_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1');

insert into public.topics (id, course_id, title, position) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'T1', 0),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 'T2', 0);

insert into public.resources (id, topic_id, type, title, url, body_md, storage_path, file_name, file_size) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'link', 'r_open', 'https://example.com', null, null, null, null),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1', 'note', 'r_a', null, '# salom', null, null, null),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d2', 'link', 'r_fe', 'https://example.com', null, null, null, null),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000d1', 'file', 'r_file', null, null, 'T1/x.pdf', 'x.pdf', 1234);
insert into public.resource_groups (resource_id, group_id) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-00000000000a');

insert into storage.objects (bucket_id, name) values ('resources', 'T1/x.pdf');

-- ===== 1-3. Funksiyalar va bucket =====
select ok(
  not has_function_privilege('anon', 'public.can_access_course(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.can_access_course(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.can_access_resource(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.can_access_resource(uuid, uuid)', 'execute'),
  'can_access_*: anon emas, authenticated chaqira oladi'
);
select is(
  (select public from storage.buckets where id = 'resources'), false,
  'resources bucket private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'resources'), 52428800::bigint,
  'resources bucket 50 MB limit'
);

-- ===== 4-8. a1 =====
select tests.authenticate_as(current_setting('test.a1')::uuid);
select is((select count(*)::int from public.resources), 3, 'a1: r_open, r_a, r_file (3 qator)');
select is_empty($$ select 1 from public.resources where title = 'r_fe' $$, 'a1: r_fe ko''rinmaydi');
select is_empty($$ select 1 from public.topics where title = 'T2' $$, 'a1: T2 ko''rinmaydi');
select is((select count(*)::int from public.topics), 1, 'a1: faqat T1');
select is((select count(*)::int from storage.objects where bucket_id = 'resources' and name = 'T1/x.pdf'), 1,
  'a1: T1/x.pdf storage da ko''rinadi');

-- ===== 9-11. a1 yozolmaydi =====
select throws_ok(
  $$ insert into public.resources (topic_id, type, title, url)
     values ('00000000-0000-0000-0000-0000000000d1', 'link', 'hack', 'https://x.com') $$,
  '42501', null, 'a1: resources ga insert qila olmaydi'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('resources', 'T1/hack.pdf') $$,
  '42501', null, 'a1: storage.objects ga insert qila olmaydi'
);
select throws_ok(
  $$ insert into public.topics (course_id, title) values ('00000000-0000-0000-0000-0000000000c1', 'hack') $$,
  '42501', null, 'a1: topics ga insert qila olmaydi'
);

-- ===== 12-13. resource_views =====
select throws_ok(
  format($$ insert into public.resource_views (student_id, resource_id)
            values (%L, '00000000-0000-0000-0000-0000000000e1') $$, current_setting('test.b1')),
  '42501', null, 'a1 nomidan b1 uchun resource_views insert xato'
);
select lives_ok(
  format($$ insert into public.resource_views (student_id, resource_id)
            values (%L, '00000000-0000-0000-0000-0000000000e2') $$, current_setting('test.a1')),
  'a1: o''z r_a ko''rishini yoza oladi'
);

-- ===== 14-21. b1 =====
select tests.authenticate_as(current_setting('test.b1')::uuid);
select is((select count(*)::int from public.resources), 1, 'b1: faqat r_open');
select is_empty($$ select 1 from public.resources where title = 'r_fe' $$, 'b1: r_fe ko''rinmaydi');
select is_empty($$ select 1 from public.topics where title = 'T2' $$, 'b1: T2 ko''rinmaydi');
select is_empty($$ select 1 from storage.objects where bucket_id = 'resources' and name = 'T1/x.pdf' $$,
  'b1: T1/x.pdf storage da ko''rinmaydi');
select throws_ok(
  format($$ insert into public.resource_views (student_id, resource_id)
            values (%L, '00000000-0000-0000-0000-0000000000e2') $$, current_setting('test.b1')),
  '42501', null, 'b1: r_a uchun resource_views insert qila olmaydi'
);
select lives_ok(
  format($$ insert into public.resource_views (student_id, resource_id)
            values (%L, '00000000-0000-0000-0000-0000000000e1') $$, current_setting('test.b1')),
  'b1: r_open uchun resource_views insert qila oladi'
);
select lives_ok(
  format($$ insert into public.resource_views (student_id, resource_id)
            values (%L, '00000000-0000-0000-0000-0000000000e1') on conflict do nothing $$, current_setting('test.b1')),
  'b1: takroriy insert (on conflict do nothing) xatosiz'
);
select is((select count(*)::int from public.resource_views), 1, 'b1: takroriy insert qator sonini oshirmaydi');

-- ===== 22-24. o'qituvchi =====
select tests.authenticate_as(current_setting('test.t')::uuid);
select is((select count(*)::int from public.resources), 4, 't: barcha resurslar');
select is((select count(*)::int from public.topics), 2, 't: barcha mavzular');
select is((select count(*)::int from storage.objects where bucket_id = 'resources' and name = 'T1/x.pdf'), 1,
  't: storage faylini ko''radi');

-- ===== 25. moveStudent analogi (a1 -> B) =====
select tests.clear_auth();
update public.group_memberships set left_at = now()
 where student_id = current_setting('test.a1')::uuid and left_at is null;
insert into public.group_memberships (student_id, group_id)
values (current_setting('test.a1')::uuid, '00000000-0000-0000-0000-00000000000b');
select tests.authenticate_as(current_setting('test.a1')::uuid);
select results_eq(
  $$ select title from public.resources order by title $$,
  $$ values ('r_open'::text) $$,
  'a1 B ga o''tgach r_a va r_file ko''rinmaydi, r_open qoladi'
);

-- ===== 26-29. Check va restrict (postgres sifatida) =====
select tests.clear_auth();
select throws_ok(
  $$ insert into public.resources (topic_id, type, title, url, storage_path)
     values ('00000000-0000-0000-0000-0000000000d1', 'link', 'bad link', 'https://x.com', 'T1/y.pdf') $$,
  '23514', null, 'link turida storage_path xato'
);
select throws_ok(
  $$ insert into public.resources (topic_id, type, title, body_md)
     values ('00000000-0000-0000-0000-0000000000d1', 'note', 'bad note', null) $$,
  '23514', null, 'note turida body_md null xato'
);
select throws_ok(
  $$ insert into public.resources (topic_id, type, title, url)
     values ('00000000-0000-0000-0000-0000000000d1', 'link', 'a', 'https://x.com') $$,
  '23514', null, 'title = ''a'' xato'
);
select throws_ok(
  $$ delete from public.topics where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '23503', null, 'resursi bor mavzuni o''chirish xato (restrict)'
);

-- ===== 30-32. can_access_course =====
select is(
  public.can_access_course(current_setting('test.b1')::uuid, '00000000-0000-0000-0000-0000000000c1'),
  true, 'can_access_course: b1 CS ga kira oladi'
);
select is(
  public.can_access_course(current_setting('test.b1')::uuid, '00000000-0000-0000-0000-0000000000c2'),
  false, 'can_access_course: b1 FE ga kira olmaydi'
);
update public.group_courses set ended_at = now()
 where group_id = '00000000-0000-0000-0000-00000000000b' and ended_at is null;
select is(
  public.can_access_course(current_setting('test.b1')::uuid, '00000000-0000-0000-0000-0000000000c1'),
  true, 'can_access_course: tugagan (tarixdagi) kurs ham ochiq'
);

select * from finish();
rollback;
