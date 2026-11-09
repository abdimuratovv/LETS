begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- Tayyorlov (postgres sifatida): ikki guruh, ikki kurs, bitta o'quvchi
insert into public.groups (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'A guruh'),
  ('00000000-0000-0000-0000-0000000000a2', 'B guruh');

insert into public.courses (id, title, position) values
  ('00000000-0000-0000-0000-0000000000c1', 'Kurs 1', 1),
  ('00000000-0000-0000-0000-0000000000c2', 'Kurs 2', 2);

select set_config(
  'test.ali',
  tests.create_user('ali', 'student', '00000000-0000-0000-0000-0000000000a1')::text,
  true
);

-- 1. Bitta o'quvchiga ikkinchi faol a'zolik -> unique violation
select throws_ok(
  $$ insert into public.group_memberships (student_id, group_id)
     values (current_setting('test.ali')::uuid, '00000000-0000-0000-0000-0000000000a2') $$,
  '23505',
  null,
  'ikkinchi faol a''zolik rad etiladi'
);

-- 2. Birinchisiga left_at qo'yilgach ikkinchisi muvaffaqiyatli
update public.group_memberships
   set left_at = now()
 where student_id = current_setting('test.ali')::uuid
   and left_at is null;

select lives_ok(
  $$ insert into public.group_memberships (student_id, group_id)
     values (current_setting('test.ali')::uuid, '00000000-0000-0000-0000-0000000000a2') $$,
  'eski a''zolik yopilgach yangi faol a''zolik qo''shiladi'
);

-- 3. Bir guruhga ikkinchi faol group_courses -> unique violation
insert into public.group_courses (group_id, course_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1');

select throws_ok(
  $$ insert into public.group_courses (group_id, course_id)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2') $$,
  '23505',
  null,
  'guruhga ikkinchi faol kurs rad etiladi'
);

-- 4. Katta harfli login -> check violation
select throws_ok(
  $$ update public.profiles set login = 'Ali' where id = current_setting('test.ali')::uuid $$,
  '23514',
  null,
  'katta harfli login rad etiladi'
);

-- 5. Maxfiylik sozlamalarining boshlang'ich qiymatlari
select results_eq(
  $$ select p.item::text, p.scope::text from public.privacy_settings p order by p.item $$,
  $$ values ('avatar', 'own_group'),
            ('online_status', 'own_group'),
            ('stats', 'own_group'),
            ('badges', 'everyone'),
            ('birthday', 'own_group') $$,
  'privacy_settings: badges=everyone, qolganlari own_group'
);

-- 6. onboarding_done = true, lekin birth_date yo'q -> check violation
select throws_ok(
  $$ update public.profiles
        set onboarding_done = true, full_name = 'Ali Valiyev', birth_date = null
      where id = current_setting('test.ali')::uuid $$,
  '23514',
  null,
  'tug''ilgan kunsiz onboarding yakunlanmaydi'
);

-- 7. Noma'lum avatar -> check violation
select throws_ok(
  $$ update public.profiles
        set avatar_config = '{"base":"dragon"}'
      where id = current_setting('test.ali')::uuid $$,
  '23514',
  null,
  'ro''yxatda yo''q avatar rad etiladi'
);

-- 8. Boshlang'ich avatar
select is(
  (select avatar_config from public.profiles where id = current_setting('test.ali')::uuid),
  '{"base":"wolf"}'::jsonb,
  'boshlang''ich avatar wolf'
);

-- 9. Barcha jadvallarda RLS yoqilgan
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('profiles', 'profile_name_changes', 'courses', 'groups',
                        'group_courses', 'group_memberships', 'privacy_settings',
                        'privacy_group_overrides')
      and c.relrowsecurity),
  8,
  'sakkizta jadvalning hammasida RLS yoqilgan'
);

-- 10. O'qituvchi onboardingsiz (tug'ilgan kunsiz) onboarding_done = true bo'la oladi (create-teacher)
select set_config('test.ustoz', tests.create_user('ustoz', 'teacher')::text, true);

select lives_ok(
  $$ update public.profiles
        set onboarding_done = true, full_name = 'Ustoz Ustozov'
      where id = current_setting('test.ustoz')::uuid $$,
  'o''qituvchi tug''ilgan kunsiz onboarding_done = true bo''ladi'
);

select * from finish();
rollback;
