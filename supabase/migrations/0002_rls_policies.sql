-- 0002_rls_policies.sql
-- Row-level security: tenants see only their own rows, admins see everything.

-- Helper used by many policies. SECURITY DEFINER lets it read profiles without
-- triggering the profiles policies again (which would recurse).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

alter table public.profiles           enable row level security;
alter table public.listings           enable row level security;
alter table public.applications       enable row level security;
alter table public.application_events enable row level security;

-- profiles: read your own row (admins can read all). No update/insert/delete
-- policies exist, so nobody can change a role from the client.
create policy "profiles: read own or admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- listings: anyone can browse active listings; admins can see inactive ones too.
create policy "listings: public read of active"
  on public.listings for select
  to anon, authenticated
  using (is_active or public.is_admin());

-- applications
create policy "applications: tenant reads own, admin reads all"
  on public.applications for select
  to authenticated
  using (tenant_id = (select auth.uid()) or public.is_admin());

-- A tenant can only create applications for themselves, and always as 'new'.
create policy "applications: tenant inserts own as new"
  on public.applications for insert
  to authenticated
  with check (tenant_id = (select auth.uid()) and status = 'new');

-- Only admins can change an application (i.e. move it through the pipeline).
create policy "applications: admin updates"
  on public.applications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- application_events: tenants can read the history of their own applications.
create policy "events: tenant reads own, admin reads all"
  on public.application_events for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.applications a
      where a.id = application_events.application_id
        and a.tenant_id = (select auth.uid())
    )
  );
-- No insert policy: events are written only by the trigger in 0004.
