-- 0001_schema.sql
-- Core tables for the mini ApartmentHub: profiles, listings, applications,
-- and an audit trail of status changes.

create type public.user_role as enum ('tenant', 'admin');

create type public.application_status as enum (
  'new',
  'screening',
  'viewing',
  'approved',
  'rejected'
);

-- One row per auth user. Created automatically by a trigger (see below).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        public.user_role not null default 'tenant',
  created_at  timestamptz not null default now()
);

-- Apartments that tenants can apply for. Descriptions are stored per language.
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  city           text not null,
  rent_eur       integer not null check (rent_eur > 0),
  bedrooms       smallint not null check (bedrooms >= 0),
  description_nl text not null,
  description_en text not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- A tenant's application for one listing.
create table public.applications (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null default auth.uid()
                       references public.profiles (id) on delete cascade,
  listing_id         uuid not null
                       references public.listings (id) on delete restrict,
  full_name          text not null check (char_length(full_name) between 2 and 120),
  email              text not null,
  phone              text,
  monthly_income_eur integer not null check (monthly_income_eur >= 0),
  household_size     smallint not null check (household_size between 1 and 12),
  move_in_date       date not null,
  message            text check (char_length(message) <= 1000),
  document_path      text,
  status             public.application_status not null default 'new',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- A tenant can only apply once per listing.
  unique (tenant_id, listing_id)
);

create index applications_status_idx     on public.applications (status);
create index applications_listing_id_idx on public.applications (listing_id);

-- History of every status change (who moved what, and when).
create table public.application_events (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status    public.application_status,
  to_status      public.application_status not null,
  changed_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index application_events_application_id_idx
  on public.application_events (application_id);

-- Keep updated_at fresh on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user. The role is ALWAYS 'tenant' here;
-- we never read it from user-supplied metadata (that would allow self-promotion).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
