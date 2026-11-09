-- 2-bosqich: resurs fayllari uchun private Storage bucket va siyosatlar.
-- Yo'l: <topic_id>/<uuid>.<kengaytma>. Yozish/o'chirish faqat o'qituvchiga;
-- o'qish — o'qituvchiga yoki resursga kirish huquqi bor o'quvchiga.

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 52428800)
on conflict (id) do update
  set public = false, file_size_limit = 52428800;

create policy resources_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resources' and public.is_teacher());

create policy resources_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and public.is_teacher());

create policy resources_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resources'
    and (
      public.is_teacher()
      or exists (
        select 1
          from public.resources r
         where r.storage_path = storage.objects.name
           and public.can_access_resource((select auth.uid()), r.id)
      )
    )
  );
