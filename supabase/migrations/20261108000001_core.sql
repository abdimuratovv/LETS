-- 1-bosqich: asosiy sxema (profillar, kurslar, guruhlar, maxfiylik)
-- RLS har bir jadvalda shu yerda yoqiladi; siyosatlar keyingi migratsiyalarda.

-- ===== Enumlar =====
create type public.user_role as enum ('teacher', 'student');
create type public.user_status as enum ('active', 'archived');
create type public.course_status as enum ('active', 'finished');
create type public.privacy_item as enum ('avatar', 'online_status', 'stats', 'badges', 'birthday');
create type public.privacy_scope as enum ('everyone', 'own_group', 'nobody');

-- ===== Profillar =====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  login text not null unique
    constraint profiles_login_format check (login ~ '^[a-z0-9_.]{3,20}$'),
  full_name text,
  nickname text,
  birth_date date,
  birth_date_locked boolean not null default false,
  avatar_config jsonb not null default '{"base":"wolf"}'::jsonb
    constraint profiles_avatar_base check (
      avatar_config ->> 'base' in ('wolf', 'fox', 'deer', 'bear', 'cat', 'owl', 'rabbit', 'panda')
    ),
  status public.user_status not null default 'active',
  onboarding_done boolean not null default false,
  name_edit_locked boolean not null default false,
  last_seen_at timestamptz,
  -- Onboarding faqat o'quvchilar uchun; o'qituvchi create-teacher orqali onboarding_done=true bilan yaratiladi.
  constraint profiles_onboarding_complete check (
    role = 'teacher' or onboarding_done = false or (full_name is not null and birth_date is not null)
  )
);

create table public.profile_name_changes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  field text not null check (field in ('full_name', 'nickname')),
  old_value text,
  new_value text,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index profile_name_changes_profile_idx
  on public.profile_name_changes (profile_id, changed_at desc);

-- ===== Kurslar va guruhlar =====
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position integer not null default 0,
  status public.course_status not null default 'active'
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);

create table public.group_courses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Bir guruhda bir vaqtda bitta faol kurs
create unique index group_courses_one_active
  on public.group_courses (group_id) where ended_at is null;
create index group_courses_course_idx on public.group_courses (course_id);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

-- Bir o'quvchida bir vaqtda bitta faol a'zolik
create unique index group_memberships_one_active
  on public.group_memberships (student_id) where left_at is null;
create index group_memberships_group_idx on public.group_memberships (group_id);

-- ===== Maxfiylik =====
create table public.privacy_settings (
  item public.privacy_item primary key,
  scope public.privacy_scope not null
);

create table public.privacy_group_overrides (
  item public.privacy_item not null,
  group_id uuid not null references public.groups (id) on delete cascade,
  scope public.privacy_scope not null,
  primary key (item, group_id)
);

create index privacy_group_overrides_group_idx on public.privacy_group_overrides (group_id);

insert into public.privacy_settings (item, scope) values
  ('avatar', 'own_group'),
  ('online_status', 'own_group'),
  ('stats', 'own_group'),
  ('badges', 'everyone'),
  ('birthday', 'own_group');

-- ===== RLS: hamma narsa yopiq, siyosatlar keyin =====
alter table public.profiles enable row level security;
alter table public.profile_name_changes enable row level security;
alter table public.courses enable row level security;
alter table public.groups enable row level security;
alter table public.group_courses enable row level security;
alter table public.group_memberships enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.privacy_group_overrides enable row level security;
