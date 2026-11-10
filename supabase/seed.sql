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

-- Supabase "Automatic RLS" ni lokalda taqlid qilish (production'da platforma yaratadi:
-- public.rls_auto_enable() + ensure_rls event trigger; funksiya ta'rifi production'dan olingan).
-- Seed migratsiyalardan keyin ishlagani uchun 20261110000006 dagi revoke bu funksiyaga tegmaydi;
-- production'dagi yakuniy holatni (hech kim chaqira olmaydi) shu yerda takrorlaymiz.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
  tbl name;
begin
  for cmd in
    select *
      from pg_event_trigger_ddl_commands()
     where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
       and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public') then
      begin
        select c.relname into tbl from pg_catalog.pg_class c where c.oid = cmd.objid;
        execute format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    end if;
  end loop;
end;
$$;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

grant usage on schema tests to anon, authenticated;
grant execute on function tests.authenticate_as(uuid) to anon, authenticated;
grant execute on function tests.clear_auth() to anon, authenticated;
