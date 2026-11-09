-- 1-bosqich: maxfiylik funksiyalari (active_group_id, can_view, list_visible_students) va qolgan RLS siyosatlari.
-- profiles siyosatlari 20261108000002 da (Ruling R4). authenticated/anon da jadval grantlari bor,
-- shuning uchun RLS siyosatlari yagona to'siq: siyosati yo'q amal rad etiladi.

-- ===== active_group_id(uid) =====
-- O'quvchining faol (left_at is null) a'zoligidagi guruh; bo'lmasa null.
create or replace function public.active_group_id(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gm.group_id
    from public.group_memberships gm
   where gm.student_id = active_group_id.uid
     and gm.left_at is null
   limit 1;
$$;

-- ===== can_view(viewer, target, item) =====
-- Spec 5.3 qoidasi bitta joyda. Tartib: viewer o'qituvchi -> true; viewer = target -> true;
-- target arxivda (yoki yo'q) -> false; scope = coalesce(target faol guruhi uchun istisno, umumiy);
-- everyone -> true; own_group -> ikkalasining faol guruhi bir xil va null emas; nobody -> false.
create or replace function public.can_view(viewer uuid, target uuid, item public.privacy_item)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope public.privacy_scope;
  v_target_group uuid;
  v_viewer_group uuid;
begin
  if can_view.viewer is null or can_view.target is null or can_view.item is null then
    return false;
  end if;

  if exists (
    select 1
      from public.profiles p
     where p.id = can_view.viewer
       and p.role = 'teacher'
       and p.status = 'active'
  ) then
    return true;
  end if;

  if can_view.viewer = can_view.target then
    return true;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = can_view.target
       and p.status = 'active'
  ) then
    return false;
  end if;

  v_target_group := public.active_group_id(can_view.target);

  select coalesce(
           (select o.scope
              from public.privacy_group_overrides o
             where o.item = can_view.item
               and o.group_id = v_target_group),
           (select s.scope
              from public.privacy_settings s
             where s.item = can_view.item)
         )
    into v_scope;

  if v_scope = 'everyone' then
    return true;
  elsif v_scope = 'own_group' then
    v_viewer_group := public.active_group_id(can_view.viewer);
    return v_target_group is not null and v_viewer_group = v_target_group;
  end if;

  -- nobody yoki sozlama topilmadi
  return false;
end;
$$;

-- ===== list_visible_students() =====
-- Chaqiruvchi faqat auth.uid() (parametr yo'q). Faqat faol o'quvchilar, chaqiruvchining o'zi chiqmaydi.
-- Qator: chaqiruvchi o'qituvchi, yoki bir guruhda, yoki beshta elementdan kamida biri ko'rinadi.
-- Ruxsatsiz ustunlar null. Arxivdagi (yoki profilsiz) chaqiruvchi hech narsa olmaydi.
create or replace function public.list_visible_students()
returns table (
  id uuid,
  full_name text,
  nickname text,
  group_id uuid,
  same_group boolean,
  avatar_config jsonb,
  last_seen_at timestamptz,
  birthday_md text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id as uid,
           (p.role = 'teacher') as is_teacher,
           public.active_group_id(p.id) as gid
      from public.profiles p
     where p.id = (select auth.uid())
       and p.status = 'active'
  ),
  candidates as (
    select p.id as sid,
           p.full_name as s_full_name,
           p.nickname as s_nickname,
           p.avatar_config as s_avatar_config,
           p.last_seen_at as s_last_seen_at,
           p.birth_date as s_birth_date,
           public.active_group_id(p.id) as s_gid,
           me.uid,
           me.is_teacher,
           me.gid
      from public.profiles p
     cross join me
     where p.role = 'student'
       and p.status = 'active'
       and p.id <> me.uid
  ),
  visibility as (
    select c.*,
           (c.gid is not null and c.s_gid = c.gid) as same,
           public.can_view(c.uid, c.sid, 'avatar') as v_avatar,
           public.can_view(c.uid, c.sid, 'online_status') as v_online,
           public.can_view(c.uid, c.sid, 'stats') as v_stats,
           public.can_view(c.uid, c.sid, 'badges') as v_badges,
           public.can_view(c.uid, c.sid, 'birthday') as v_birthday
      from candidates c
  )
  select v.sid,
         v.s_full_name,
         v.s_nickname,
         v.s_gid,
         v.same,
         case when v.v_avatar then v.s_avatar_config end,
         case when v.v_online then v.s_last_seen_at end,
         case when v.v_birthday then to_char(v.s_birth_date, 'MM-DD') end
    from visibility v
   where v.is_teacher
      or v.same
      or v.v_avatar
      or v.v_online
      or v.v_stats
      or v.v_badges
      or v.v_birthday
   order by v.s_full_name nulls last, v.sid;
$$;

-- Faqat tizimga kirgan foydalanuvchi chaqira oladi.
revoke execute on function public.active_group_id(uuid) from public, anon;
revoke execute on function public.can_view(uuid, uuid, public.privacy_item) from public, anon;
revoke execute on function public.list_visible_students() from public, anon;
grant execute on function public.active_group_id(uuid) to authenticated;
grant execute on function public.can_view(uuid, uuid, public.privacy_item) to authenticated;
grant execute on function public.list_visible_students() to authenticated;

-- ===== profile_name_changes: faqat o'qish (o'z profili yoki o'qituvchi) =====
-- Yozuvlar faqat profiles_log_names triggeri (security definer) orqali.
create policy profile_name_changes_select_self_or_teacher
  on public.profile_name_changes
  for select
  to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_teacher()));

-- ===== Umumiy jadvallar: o'qish hammaga (authenticated), yozish faqat o'qituvchi =====
-- courses
create policy courses_select_authenticated
  on public.courses for select to authenticated
  using (true);
create policy courses_insert_teacher
  on public.courses for insert to authenticated
  with check ((select public.is_teacher()));
create policy courses_update_teacher
  on public.courses for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));
create policy courses_delete_teacher
  on public.courses for delete to authenticated
  using ((select public.is_teacher()));

-- groups
create policy groups_select_authenticated
  on public.groups for select to authenticated
  using (true);
create policy groups_insert_teacher
  on public.groups for insert to authenticated
  with check ((select public.is_teacher()));
create policy groups_update_teacher
  on public.groups for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));
create policy groups_delete_teacher
  on public.groups for delete to authenticated
  using ((select public.is_teacher()));

-- group_courses
create policy group_courses_select_authenticated
  on public.group_courses for select to authenticated
  using (true);
create policy group_courses_insert_teacher
  on public.group_courses for insert to authenticated
  with check ((select public.is_teacher()));
create policy group_courses_update_teacher
  on public.group_courses for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));
create policy group_courses_delete_teacher
  on public.group_courses for delete to authenticated
  using ((select public.is_teacher()));

-- privacy_settings
create policy privacy_settings_select_authenticated
  on public.privacy_settings for select to authenticated
  using (true);
create policy privacy_settings_insert_teacher
  on public.privacy_settings for insert to authenticated
  with check ((select public.is_teacher()));
create policy privacy_settings_update_teacher
  on public.privacy_settings for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));
create policy privacy_settings_delete_teacher
  on public.privacy_settings for delete to authenticated
  using ((select public.is_teacher()));

-- privacy_group_overrides
create policy privacy_group_overrides_select_authenticated
  on public.privacy_group_overrides for select to authenticated
  using (true);
create policy privacy_group_overrides_insert_teacher
  on public.privacy_group_overrides for insert to authenticated
  with check ((select public.is_teacher()));
create policy privacy_group_overrides_update_teacher
  on public.privacy_group_overrides for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));
create policy privacy_group_overrides_delete_teacher
  on public.privacy_group_overrides for delete to authenticated
  using ((select public.is_teacher()));

-- ===== group_memberships: o'qish o'zi yoki o'qituvchi, yozish faqat o'qituvchi =====
create policy group_memberships_select_self_or_teacher
  on public.group_memberships for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_teacher()));
create policy group_memberships_insert_teacher
  on public.group_memberships for insert to authenticated
  with check ((select public.is_teacher()));
create policy group_memberships_update_teacher
  on public.group_memberships for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));
create policy group_memberships_delete_teacher
  on public.group_memberships for delete to authenticated
  using ((select public.is_teacher()));
