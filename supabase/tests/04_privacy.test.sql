begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- ===== Tayyorlov (postgres sifatida) =====
-- Guruh A (a1, a2, arxivdagi a3), guruh B (b1), o'qituvchi t
insert into public.groups (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'A guruh'),
  ('00000000-0000-0000-0000-00000000000b', 'B guruh');

select set_config('test.t', tests.create_user('ustoz', 'teacher')::text, true);
select set_config('test.a1',
  tests.create_user('a1_user', 'student', '00000000-0000-0000-0000-00000000000a')::text, true);
select set_config('test.a2',
  tests.create_user('a2_user', 'student', '00000000-0000-0000-0000-00000000000a')::text, true);
select set_config('test.a3',
  tests.create_user('a3_user', 'student', '00000000-0000-0000-0000-00000000000a')::text, true);
select set_config('test.b1',
  tests.create_user('b1_user', 'student', '00000000-0000-0000-0000-00000000000b')::text, true);

update public.profiles set full_name = 'Arxiv Talaba', status = 'archived'
 where id = current_setting('test.a3')::uuid;
update public.profiles
   set full_name = 'Ali Valiyev', birth_date = '2012-03-15', last_seen_at = now()
 where id = current_setting('test.a2')::uuid;
update public.profiles
   set full_name = 'Bobur Karimov', birth_date = '2011-07-20', last_seen_at = now()
 where id = current_setting('test.b1')::uuid;
-- a2 ning ism tarixi (b1 uchun ham) — a1 ko'rmasligi kerak
update public.profiles set nickname = 'ali' where id = current_setting('test.a2')::uuid;

-- ===== 1-3. Funksiyalar faqat authenticated uchun =====
select ok(
  not has_function_privilege('anon', 'public.can_view(uuid, uuid, public.privacy_item)', 'execute')
  and has_function_privilege('authenticated', 'public.can_view(uuid, uuid, public.privacy_item)', 'execute'),
  'can_view: anon emas, authenticated chaqira oladi'
);
select ok(
  not has_function_privilege('anon', 'public.active_group_id(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.active_group_id(uuid)', 'execute'),
  'active_group_id: anon emas, authenticated chaqira oladi'
);
select ok(
  not has_function_privilege('anon', 'public.list_visible_students()', 'execute')
  and has_function_privilege('authenticated', 'public.list_visible_students()', 'execute'),
  'list_visible_students: anon emas, authenticated chaqira oladi'
);

-- ===== 4-8. Boshlang'ich sozlama =====
select is(
  public.active_group_id(current_setting('test.a1')::uuid),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'active_group_id faol guruhni qaytaradi'
);
select is(
  public.can_view(current_setting('test.a1')::uuid, current_setting('test.a2')::uuid, 'avatar'),
  true, 'bir guruh: avatar ko''rinadi'
);
select is(
  public.can_view(current_setting('test.a1')::uuid, current_setting('test.b1')::uuid, 'avatar'),
  false, 'boshqa guruh: avatar ko''rinmaydi'
);
select is(
  public.can_view(current_setting('test.a1')::uuid, current_setting('test.b1')::uuid, 'badges'),
  true, 'boshqa guruh: badges hammaga ochiq'
);
select is(
  public.can_view(current_setting('test.a1')::uuid, current_setting('test.a3')::uuid, 'badges'),
  false, 'arxivdagi o''quvchi ko''rinmaydi'
);

-- ===== 9-12. a1 sifatida list_visible_students() =====
select tests.authenticate_as(current_setting('test.a1')::uuid);

select set_eq(
  $$ select id from public.list_visible_students() $$,
  array[current_setting('test.a2')::uuid, current_setting('test.b1')::uuid],
  'a1 ro''yxatida a2 va b1 bor; a3 va a1 yo''q'
);
select results_eq(
  $$ select same_group, avatar_config is not null, last_seen_at is not null, birthday_md
       from public.list_visible_students() where id = current_setting('test.a2')::uuid $$,
  $$ values (true, true, true, '03-15'::text) $$,
  'a2: bir guruh, avatar/online/tug''ilgan kun (MM-DD) ko''rinadi'
);
select results_eq(
  $$ select same_group, full_name, avatar_config, last_seen_at, birthday_md
       from public.list_visible_students() where id = current_setting('test.b1')::uuid $$,
  $$ values (false, 'Bobur Karimov'::text, null::jsonb, null::timestamptz, null::text) $$,
  'b1: ism bor, avatar/online/tug''ilgan kun null'
);
select is(
  (select group_id from public.list_visible_students() where id = current_setting('test.b1')::uuid),
  '00000000-0000-0000-0000-00000000000b'::uuid,
  'b1 guruhi qaytariladi'
);

-- ===== 13-20. RLS (a1 sifatida) =====
select is_empty(
  $$ select * from public.profiles where id = current_setting('test.a2')::uuid $$,
  'o''quvchi boshqa o''quvchi profilini ko''rmaydi'
);
select results_eq(
  $$ select student_id from public.group_memberships $$,
  $$ values (current_setting('test.a1')::uuid) $$,
  'o''quvchi faqat o''z a''zoligini ko''radi'
);
select is_empty(
  $$ select * from public.profile_name_changes $$,
  'o''quvchi boshqalarning ism tarixini ko''rmaydi'
);
select is(
  (select count(*)::int from public.groups), 2,
  'o''quvchi guruhlarni ko''radi'
);
select is(
  (select count(*)::int from public.privacy_settings), 5,
  'o''quvchi maxfiylik sozlamalarini ko''radi'
);
select throws_ok(
  $$ insert into public.groups (name) values ('Hiyla guruh') $$,
  '42501', null, 'o''quvchi guruh yarata olmaydi'
);
select throws_ok(
  $$ insert into public.group_memberships (student_id, group_id)
     values (current_setting('test.a1')::uuid, '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'o''quvchi o''zini guruhga qo''sha olmaydi'
);
select throws_ok(
  $$ insert into public.privacy_group_overrides (item, group_id, scope)
     values ('avatar', '00000000-0000-0000-0000-00000000000b', 'everyone') $$,
  '42501', null, 'o''quvchi guruh istisnosini yarata olmaydi'
);

-- O'zgartirish/o'chirish urinishlari: RLS jim 0 qator (21-23 da tekshiriladi)
update public.privacy_settings set scope = 'everyone';
update public.group_memberships set left_at = now();
delete from public.groups;
delete from public.profiles where id = current_setting('test.a2')::uuid;

select tests.clear_auth();
select is(
  (select count(*)::int from public.privacy_settings where scope = 'everyone'), 1,
  'o''quvchi privacy_settings ni o''zgartira olmaydi (0 qator)'
);
select is(
  (select count(*)::int from public.group_memberships where left_at is null), 4,
  'o''quvchi a''zoligini o''zgartira olmaydi'
);
select is(
  (select count(*)::int from public.groups) + (select count(*)::int from public.profiles), 2 + 5,
  'o''quvchi guruh yoki profilni o''chira olmaydi'
);

-- ===== 24-26. O'qituvchi =====
select tests.authenticate_as(current_setting('test.t')::uuid);
select set_eq(
  $$ select id from public.list_visible_students() $$,
  array[current_setting('test.a1')::uuid, current_setting('test.a2')::uuid,
        current_setting('test.b1')::uuid],
  'o''qituvchi barcha faol o''quvchilarni ko''radi (arxivsiz, o''zisiz)'
);
select lives_ok(
  $$ insert into public.groups (name) values ('C guruh') $$,
  'o''qituvchi guruh yarata oladi'
);
select is(
  (select count(*)::int from public.profile_name_changes), 4,
  'o''qituvchi ism tarixini ko''radi'
);

-- ===== 27-29. avatar -> nobody =====
select tests.clear_auth();
update public.privacy_settings set scope = 'nobody' where item = 'avatar';
select is(
  public.can_view(current_setting('test.a1')::uuid, current_setting('test.a2')::uuid, 'avatar'),
  false, 'avatar nobody: bir guruhga ham ko''rinmaydi'
);
select is(
  public.can_view(current_setting('test.t')::uuid, current_setting('test.a2')::uuid, 'avatar'),
  true, 'avatar nobody: o''qituvchi ko''radi'
);
select is(
  public.can_view(current_setting('test.a2')::uuid, current_setting('test.a2')::uuid, 'avatar'),
  true, 'avatar nobody: o''zi ko''radi'
);

-- ===== 30-31. stats -> everyone, B uchun nobody =====
update public.privacy_settings set scope = 'everyone' where item = 'stats';
insert into public.privacy_group_overrides (item, group_id, scope)
values ('stats', '00000000-0000-0000-0000-00000000000b', 'nobody');
select is(
  public.can_view(current_setting('test.a1')::uuid, current_setting('test.b1')::uuid, 'stats'),
  false, 'B istisnosi: b1 statistikasi a1 ga yopiq'
);
select is(
  public.can_view(current_setting('test.b1')::uuid, current_setting('test.a1')::uuid, 'stats'),
  true, 'istisno target guruhiga qo''llanadi: a1 statistikasi b1 ga ochiq'
);

-- ===== 32. Hammasi own_group: b1 a1 ro'yxatida yo'q =====
delete from public.privacy_group_overrides;
update public.privacy_settings set scope = 'own_group';
select tests.authenticate_as(current_setting('test.a1')::uuid);
select set_eq(
  $$ select id from public.list_visible_students() $$,
  array[current_setting('test.a2')::uuid],
  'hammasi own_group: boshqa guruh o''quvchisi chiqmaydi'
);

-- ===== 33-34. Guruhsiz o'quvchi =====
select tests.clear_auth();
update public.group_memberships set left_at = now()
 where student_id = current_setting('test.b1')::uuid;
select is(
  public.active_group_id(current_setting('test.b1')::uuid), null::uuid,
  'faol a''zolik bo''lmasa active_group_id null'
);
select tests.authenticate_as(current_setting('test.b1')::uuid);
select is_empty(
  $$ select id from public.list_visible_students() $$,
  'guruhsiz o''quvchi (hammasi own_group) hech kimni ko''rmaydi'
);

-- ===== 35-36. Chaqiruvchi guruhi null bo'lsa own_group ochilmaydi =====
select is(
  public.can_view(current_setting('test.b1')::uuid, current_setting('test.b1')::uuid, 'avatar'),
  true, 'guruhsiz o''quvchi o''zini ko''radi'
);
select tests.clear_auth();
update public.group_memberships set left_at = now()
 where student_id = current_setting('test.a1')::uuid;
select is(
  public.can_view(current_setting('test.a1')::uuid, current_setting('test.b1')::uuid, 'birthday'),
  false, 'ikkalasi guruhsiz: own_group ochilmaydi (null = null emas)'
);

select * from finish();
rollback;
