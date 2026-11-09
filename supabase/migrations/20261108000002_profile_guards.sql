-- 1-bosqich: profil himoyasi (is_teacher, guard va tarix triggerlari, profiles RLS siyosatlari)

-- ===== is_teacher() =====
-- security definer: profiles RLS siyosatlari ichidan chaqiriladi, rekursiyasiz o'qiydi.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = (select auth.uid())
       and p.role = 'teacher'
       and p.status = 'active'
  );
$$;

-- ===== profiles_guard (before update) =====
-- Faqat foydalanuvchi sessiyasi (auth.uid() bor) va o'qituvchi bo'lmaganda cheklaydi.
-- service_role / admin (auth.uid() null) cheklanmaydi.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_teacher() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.login is distinct from old.login
       or new.status is distinct from old.status
       or new.name_edit_locked is distinct from old.name_edit_locked
       or new.birth_date_locked is distinct from old.birth_date_locked then
      raise exception 'protected_column';
    end if;

    if old.name_edit_locked
       and (new.full_name is distinct from old.full_name
            or new.nickname is distinct from old.nickname) then
      raise exception 'name_edit_locked';
    end if;

    if old.birth_date_locked and new.birth_date is distinct from old.birth_date then
      raise exception 'birth_date_locked';
    end if;
  end if;

  -- Tug'ilgan kun bir marta kiritiladi: birinchi qiymat qo'yilganda qulflanadi (har qanday chaqiruvchi uchun).
  if old.birth_date is null and new.birth_date is not null then
    new.birth_date_locked := true;
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ===== profiles_log_names (after update) =====
-- security definer: profile_name_changes o'quvchiga yopiq, lekin tarix yozilishi shart.
create or replace function public.profiles_log_names()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.full_name is distinct from old.full_name then
    insert into public.profile_name_changes (profile_id, field, old_value, new_value, changed_by)
    values (new.id, 'full_name', old.full_name, new.full_name, (select auth.uid()));
  end if;

  if new.nickname is distinct from old.nickname then
    insert into public.profile_name_changes (profile_id, field, old_value, new_value, changed_by)
    values (new.id, 'nickname', old.nickname, new.nickname, (select auth.uid()));
  end if;

  return null;
end;
$$;

create trigger profiles_log_names
  after update on public.profiles
  for each row execute function public.profiles_log_names();

-- Trigger funksiyalarini to'g'ridan-to'g'ri chaqirib bo'lmaydi; API rollaridan EXECUTE olib tashlanadi.
revoke execute on function public.profiles_guard() from public, anon, authenticated;
revoke execute on function public.profiles_log_names() from public, anon, authenticated;

-- ===== profiles RLS siyosatlari: o'zi yoki o'qituvchi =====
-- Insert/delete siyosati yo'q: profil faqat server (service_role) orqali yaratiladi/o'chiriladi.
create policy profiles_select_self_or_teacher
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_teacher()));

create policy profiles_update_self_or_teacher
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or (select public.is_teacher()))
  with check (id = (select auth.uid()) or (select public.is_teacher()));
