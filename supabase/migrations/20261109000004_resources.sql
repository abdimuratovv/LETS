-- 2-bosqich: resurslar (mavzular, resurslar, guruh cheklovi, ko'rishlar) va kirish funksiyalari.
-- RLS siyosatlari jadvallar bilan bir migratsiyada.

create type public.resource_type as enum ('link', 'file', 'note');

-- ===== Mavzular =====
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text not null check (char_length(title) between 2 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index topics_course_idx on public.topics (course_id);

-- ===== Resurslar =====
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete restrict,
  type public.resource_type not null,
  title text not null check (char_length(title) between 2 and 120),
  url text,
  storage_path text unique,
  file_name text,
  file_size bigint,
  body_md text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Tur bo'yicha faqat o'ziga tegishli maydonlar to'ldiriladi
  constraint resources_type_fields check (
    (type = 'link'
      and url is not null
      and storage_path is null and file_name is null and file_size is null and body_md is null)
    or (type = 'file'
      and storage_path is not null and file_name is not null and file_size is not null
      and url is null and body_md is null)
    or (type = 'note'
      and body_md is not null
      and url is null and storage_path is null and file_name is null and file_size is null)
  )
);
create index resources_topic_idx on public.resources (topic_id);

-- Bo'sh bo'lsa resurs kursning barcha guruhlariga ochiq; aks holda faqat shu guruhlarga
create table public.resource_groups (
  resource_id uuid not null references public.resources (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  primary key (resource_id, group_id)
);
create index resource_groups_group_idx on public.resource_groups (group_id);

-- O'quvchi resursni birinchi ochgan vaqt
create table public.resource_views (
  student_id uuid not null references public.profiles (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (student_id, resource_id)
);
create index resource_views_resource_idx on public.resource_views (resource_id);

-- ===== Kirish funksiyalari =====
-- O'quvchining faol guruhi shu kursni (tarixdagisini ham) o'tgan bo'lsa true.
create or replace function public.can_access_course(uid uuid, cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.group_courses gc
     where gc.group_id = public.active_group_id(can_access_course.uid)
       and gc.course_id = can_access_course.cid
  );
$$;

-- Kursga kirish bor va resurs hamma guruhga ochiq yoki o'quvchining faol guruhi ro'yxatda.
create or replace function public.can_access_resource(uid uuid, rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
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
  );
$$;

revoke execute on function public.can_access_course(uuid, uuid) from public, anon;
revoke execute on function public.can_access_resource(uuid, uuid) from public, anon;
grant execute on function public.can_access_course(uuid, uuid) to authenticated;
grant execute on function public.can_access_resource(uuid, uuid) to authenticated;

-- ===== RLS =====
alter table public.topics enable row level security;
alter table public.resources enable row level security;
alter table public.resource_groups enable row level security;
alter table public.resource_views enable row level security;

create policy topics_select on public.topics
  for select to authenticated
  using (public.is_teacher() or public.can_access_course((select auth.uid()), course_id));
create policy topics_insert on public.topics
  for insert to authenticated with check (public.is_teacher());
create policy topics_update on public.topics
  for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy topics_delete on public.topics
  for delete to authenticated using (public.is_teacher());

create policy resources_select on public.resources
  for select to authenticated
  using (public.is_teacher() or public.can_access_resource((select auth.uid()), id));
create policy resources_insert on public.resources
  for insert to authenticated with check (public.is_teacher());
create policy resources_update on public.resources
  for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy resources_delete on public.resources
  for delete to authenticated using (public.is_teacher());

create policy resource_groups_all on public.resource_groups
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- update/delete siyosati yo'q: ko'rish yozuvi o'zgarmaydi
create policy resource_views_select on public.resource_views
  for select to authenticated
  using (student_id = (select auth.uid()) or public.is_teacher());
create policy resource_views_insert on public.resource_views
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and public.can_access_resource((select auth.uid()), resource_id)
  );
