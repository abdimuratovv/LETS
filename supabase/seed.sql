-- FAQAT LOKAL TESTLAR UCHUN (supabase db reset). Production'ga tushmaydi.
-- pgTAP testlari uchun yordamchi funksiyalar: tests.create_user, tests.authenticate_as, tests.clear_auth.

create schema if not exists tests;

-- auth.users + profiles (+ ixtiyoriy faol a'zolik). Postgres sifatida chaqiriladi.
create or replace function tests.create_user(
  login text,
  role public.user_role,
  group_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    create_user.login || '@students.platforma.local',
    'test-dummy-password-hash',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into public.profiles (id, role, login)
  values (uid, create_user.role, create_user.login);

  if create_user.group_id is not null then
    insert into public.group_memberships (student_id, group_id)
    values (uid, create_user.group_id);
  end if;

  return uid;
end;
$$;

-- Joriy tranzaksiya oxirigacha `authenticated` roli va JWT `sub` = uid.
create or replace function tests.authenticate_as(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- Sessiya foydalanuvchisiga (postgres) qaytish va JWT ni tozalash.
create or replace function tests.clear_auth()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'none', true);
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on function tests.authenticate_as(uuid) to anon, authenticated;
grant execute on function tests.clear_auth() to anon, authenticated;
