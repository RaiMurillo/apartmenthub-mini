-- 0003_storage.sql
-- Private bucket for application documents (ID, payslips, employer statement).
-- Files are stored under "<user id>/<random>-<filename>", so the first folder
-- of the path identifies the owner and the policies can check it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  5242880, -- 5 MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "documents: tenant uploads to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "documents: tenant reads own, admin reads all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

-- Lets the server clean up a file if the application insert fails afterwards.
create policy "documents: tenant deletes own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
