-- 0004_status_workflow.sql
-- Enforces the pipeline in the database, so the rules hold no matter which
-- client (web app, SQL editor, future API) changes a status.
--
--   new -> screening -> viewing -> approved
--   any open status  -> rejected
--   approved / rejected are final

create or replace function public.enforce_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (
       (old.status = 'new'       and new.status in ('screening', 'rejected'))
    or (old.status = 'screening' and new.status in ('viewing',   'rejected'))
    or (old.status = 'viewing'   and new.status in ('approved',  'rejected'))
  ) then
    raise exception 'Invalid status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger applications_enforce_status_transition
  before update of status on public.applications
  for each row execute function public.enforce_status_transition();

-- Record every status change in application_events.
create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.application_events (application_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger applications_log_status_change
  after update of status on public.applications
  for each row execute function public.log_status_change();

-- Also log the initial 'new' status when an application is created.
create or replace function public.log_application_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.application_events (application_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, auth.uid());
  return new;
end;
$$;

create trigger applications_log_created
  after insert on public.applications
  for each row execute function public.log_application_created();
