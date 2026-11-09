begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Tayyorlov (postgres sifatida): o'qituvchi va ikki o'quvchi
select set_config('test.teacher', tests.create_user('ustoz', 'teacher')::text, true);
select set_config('test.ali', tests.create_user('ali', 'student')::text, true);
select set_config('test.vali', tests.create_user('vali', 'student')::text, true);

update public.profiles
   set full_name = 'Ali Valiyev', nickname = 'ali'
 where id = current_setting('test.ali')::uuid;

-- ===== O'quvchi (ali) sifatida =====
select tests.authenticate_as(current_setting('test.ali')::uuid);

-- 1-3. Tug'ilgan kun: chegaradan tashqari rad, quyi chegara qabul (va qulflanadi)
select throws_ok(
  $$ update public.profiles set birth_date = '1949-12-31' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_birth_date', '1950-01-01 dan oldingi sana rad etiladi'
);
select throws_ok(
  $$ update public.profiles
        set birth_date = (now() at time zone 'Asia/Tashkent')::date + 1
      where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_birth_date', 'ertangi sana (Toshkent) rad etiladi'
);
select lives_ok(
  $$ update public.profiles set birth_date = '1950-01-01' where id = current_setting('test.ali')::uuid $$,
  '1950-01-01 qabul qilinadi'
);

-- 4. Qulflangan tug'ilgan kunni null qilib bo'lmaydi
select throws_ok(
  $$ update public.profiles set birth_date = null where id = current_setting('test.ali')::uuid $$,
  'P0001', 'birth_date_locked', 'qulflangan tug''ilgan kun null qilinmaydi'
);

-- 5. Bitta so'rovda qulfni ochib, qiymatni o'zgartirib bo'lmaydi
select throws_ok(
  $$ update public.profiles
        set birth_date_locked = false, birth_date = '2010-05-05'
      where id = current_setting('test.ali')::uuid $$,
  'P0001', 'protected_column', 'qulfni ochish + o''zgartirish bitta so''rovda rad etiladi'
);

-- 6-11. Ism-familiya
select throws_ok(
  $$ update public.profiles set full_name = 'Ali' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_full_name', 'bitta so''zli ism rad etiladi'
);
select throws_ok(
  $$ update public.profiles
        set full_name = repeat('a', 30) || ' ' || repeat('b', 30)
      where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_full_name', '61 belgili ism rad etiladi'
);
select throws_ok(
  $$ update public.profiles set full_name = '  Ali   Karimov ' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_full_name', 'normallashtirilmagan ism rad etiladi'
);
select throws_ok(
  $$ update public.profiles set full_name = null where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_full_name', 'ismni null qilib bo''lmaydi'
);
select lives_ok(
  $$ update public.profiles set full_name = 'A B' where id = current_setting('test.ali')::uuid $$,
  '3 belgili ikki so''zli ism qabul qilinadi'
);
select lives_ok(
  $$ update public.profiles
        set full_name = repeat('a', 29) || ' ' || repeat('b', 30)
      where id = current_setting('test.ali')::uuid $$,
  '60 belgili ism qabul qilinadi'
);

-- 12-16. Nickname
select throws_ok(
  $$ update public.profiles set nickname = 'a' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_nickname', '1 belgili nickname rad etiladi'
);
select throws_ok(
  $$ update public.profiles set nickname = repeat('n', 21) where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_nickname', '21 belgili nickname rad etiladi'
);
select lives_ok(
  $$ update public.profiles set nickname = 'ab' where id = current_setting('test.ali')::uuid $$,
  '2 belgili nickname qabul qilinadi'
);
select lives_ok(
  $$ update public.profiles set nickname = repeat('n', 20) where id = current_setting('test.ali')::uuid $$,
  '20 belgili nickname qabul qilinadi'
);
select lives_ok(
  $$ update public.profiles set nickname = null where id = current_setting('test.ali')::uuid $$,
  'nickname null qilinadi'
);

-- 17-20. Avatar
select throws_ok(
  $$ update public.profiles set avatar_config = '{"base":"fox","hat":"crown"}' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_avatar', 'base dan boshqa kalit rad etiladi'
);
select throws_ok(
  $$ update public.profiles set avatar_config = '{"base":"dragon"}' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_avatar', 'ro''yxatda yo''q hayvon rad etiladi'
);
select throws_ok(
  $$ update public.profiles set avatar_config = '"fox"' where id = current_setting('test.ali')::uuid $$,
  'P0001', 'invalid_avatar', 'obyekt bo''lmagan avatar rad etiladi'
);
select lives_ok(
  $$ update public.profiles set avatar_config = '{"base":"fox"}' where id = current_setting('test.ali')::uuid $$,
  'ro''yxatdagi avatar qabul qilinadi'
);

-- 21-22. onboarding_done: false -> true ruxsat, true -> false rad
select lives_ok(
  $$ update public.profiles set onboarding_done = true where id = current_setting('test.ali')::uuid $$,
  'o''quvchi onboardingni yakunlay oladi'
);
select throws_ok(
  $$ update public.profiles set onboarding_done = false where id = current_setting('test.ali')::uuid $$,
  'P0001', 'protected_column', 'onboarding_done true -> false rad etiladi'
);

-- 23. INSERT rad (insert siyosati yo'q)
select throws_ok(
  $$ insert into public.profiles (id, role, login)
     values (current_setting('test.ali')::uuid, 'student', 'yangi_login') $$,
  '42501', null, 'o''quvchi profiles ga insert qila olmaydi'
);

-- 24-25. DELETE ta'sirsiz (delete siyosati yo'q)
select lives_ok(
  $$ delete from public.profiles where id = current_setting('test.ali')::uuid $$,
  'delete xatosiz, lekin ta''sirsiz'
);
select is(
  (select count(*)::int from public.profiles where id = current_setting('test.ali')::uuid),
  1,
  'o''quvchi profili o''chirilmadi'
);

-- ===== O'quvchi (vali): bitta UPDATE bilan to'liq onboarding, yuqori chegara =====
select tests.clear_auth();
select tests.authenticate_as(current_setting('test.vali')::uuid);

select lives_ok(
  $$ update public.profiles
        set full_name = 'Vali Karimov',
            nickname = 'vali',
            birth_date = (now() at time zone 'Asia/Tashkent')::date,
            avatar_config = '{"base":"owl"}',
            onboarding_done = true
      where id = current_setting('test.vali')::uuid $$,
  'completeOnboarding shaklidagi update (bugungi sana) qabul qilinadi'
);

-- ===== O'qituvchi: qiymat tekshiruvlari qo'llanmaydi =====
select tests.clear_auth();
select tests.authenticate_as(current_setting('test.teacher')::uuid);

select lives_ok(
  $$ update public.profiles set nickname = 'x', onboarding_done = false
      where id = current_setting('test.vali')::uuid $$,
  'o''qituvchi uchun qiymat tekshiruvlari qo''llanmaydi'
);

select tests.clear_auth();

-- 28. Admin sifatida: vali yakuniy holati
select is(
  (select birth_date_locked from public.profiles where id = current_setting('test.vali')::uuid),
  true,
  'vali tug''ilgan kuni qulflandi'
);

select * from finish();
rollback;
