begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- Tayyorlov (postgres sifatida): guruh, o'qituvchi, o'quvchi
insert into public.groups (id, name)
values ('00000000-0000-0000-0000-0000000000a1', 'A guruh');

select set_config('test.teacher', tests.create_user('ustoz', 'teacher')::text, true);
select set_config(
  'test.ali',
  tests.create_user('ali', 'student', '00000000-0000-0000-0000-0000000000a1')::text,
  true
);
select set_config(
  'test.vali',
  tests.create_user('vali', 'student', '00000000-0000-0000-0000-0000000000a1')::text,
  true
);

-- Admin (auth.uid() null) cheklanmaydi; boshlang'ich ism
update public.profiles
   set full_name = 'Ali Valiyev', nickname = 'ali'
 where id = current_setting('test.ali')::uuid;

-- ===== O'quvchi sifatida =====
select tests.authenticate_as(current_setting('test.ali')::uuid);

-- 1-5. Himoyalangan ustunlar
select throws_ok(
  $$ update public.profiles set role = 'teacher' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'protected_column', 'o''quvchi o''z rolini o''zgartira olmaydi'
);
select throws_ok(
  $$ update public.profiles set status = 'archived' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'protected_column', 'o''quvchi o''z statusini o''zgartira olmaydi'
);
select throws_ok(
  $$ update public.profiles set name_edit_locked = true where id = current_setting('test.ali')::uuid $$,
  'P0001', 'protected_column', 'o''quvchi name_edit_locked ni o''zgartira olmaydi'
);
select throws_ok(
  $$ update public.profiles set login = 'ali2' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'protected_column', 'o''quvchi loginini o''zgartira olmaydi'
);
select throws_ok(
  $$ update public.profiles set birth_date_locked = true where id = current_setting('test.ali')::uuid $$,
  'P0001', 'protected_column', 'o''quvchi birth_date_locked ni o''zgartira olmaydi'
);

-- Boshqa o'quvchining profilini o'zgartirishga urinish (RLS: 0 qator; 6-testda tekshiriladi)
update public.profiles set full_name = 'Buzildi Buzildi'
 where id = current_setting('test.vali')::uuid;

-- 7. full_name o'zgartirish muvaffaqiyatli
select lives_ok(
  $$ update public.profiles set full_name = 'Ali Karimov' where id = current_setting('test.ali')::uuid $$,
  'o''quvchi o''z ismini o''zgartira oladi'
);

-- 8. Tarixda 1 qator (o'quvchining o'zi tomonidan)
select tests.clear_auth();
select results_eq(
  $$ select field, old_value, new_value
       from public.profile_name_changes
      where profile_id = current_setting('test.ali')::uuid
        and changed_by = current_setting('test.ali')::uuid $$,
  $$ values ('full_name', 'Ali Valiyev', 'Ali Karimov') $$,
  'ism o''zgarishi tarixga yozildi'
);

-- 6. Boshqa o'quvchining profili o'zgarmagan
select is(
  (select full_name from public.profiles where id = current_setting('test.vali')::uuid),
  null::text,
  'o''quvchi boshqa o''quvchi profilini o''zgartira olmaydi'
);

-- 9. O'qituvchi name_edit_locked = true qiladi
select tests.authenticate_as(current_setting('test.teacher')::uuid);
select lives_ok(
  $$ update public.profiles set name_edit_locked = true where id = current_setting('test.ali')::uuid $$,
  'o''qituvchi ism tahririni bloklay oladi'
);

-- 10. Endi o'quvchi nickname o'zgartira olmaydi
select tests.authenticate_as(current_setting('test.ali')::uuid);
select throws_ok(
  $$ update public.profiles set nickname = 'yangi' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'name_edit_locked', 'bloklangan nickname o''zgarmaydi'
);

-- 11. Tug'ilgan kun birinchi marta -> muvaffaqiyatli
select lives_ok(
  $$ update public.profiles set birth_date = '2010-05-01' where id = current_setting('test.ali')::uuid $$,
  'tug''ilgan kun birinchi marta kiritiladi'
);

-- 12. ...va avtomatik qulflanadi
select is(
  (select birth_date_locked from public.profiles where id = current_setting('test.ali')::uuid),
  true,
  'tug''ilgan kun kiritilgach qulflanadi'
);

-- 13. Ikkinchi marta -> birth_date_locked
select throws_ok(
  $$ update public.profiles set birth_date = '2011-06-02' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'birth_date_locked', 'qulflangan tug''ilgan kun o''zgarmaydi'
);

-- 14. O'qituvchi qulflangan tug'ilgan kunni o'zgartira oladi
select tests.authenticate_as(current_setting('test.teacher')::uuid);
select lives_ok(
  $$ update public.profiles set birth_date = '2010-07-03' where id = current_setting('test.ali')::uuid $$,
  'o''qituvchi qulflangan tug''ilgan kunni o''zgartiradi'
);
select is(
  (select birth_date from public.profiles where id = current_setting('test.ali')::uuid),
  '2010-07-03'::date,
  'o''qituvchi o''zgartirgan sana saqlandi'
);

-- 16. O'qituvchi o'quvchi profilini ko'radi; o'quvchi boshqasini ko'rmaydi
select tests.authenticate_as(current_setting('test.ali')::uuid);
select is(
  (select count(*)::int from public.profiles),
  1,
  'o''quvchi faqat o''z profilini ko''radi'
);

select * from finish();
rollback;
