-- 0005_reports.sql
-- Admin report: applications per pipeline status.
--
-- SECURITY DEFINER lets the function count every row, so it checks is_admin()
-- itself and refuses everyone else. All statuses are returned, even those
-- with zero applications, in pipeline order.

create or replace function public.report_applications_per_status()
returns table (
  status        public.application_status,
  total         bigint,
  share_pct     numeric,
  avg_age_days  numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    s.status,
    count(a.id)                                                      as total,
    round(100.0 * count(a.id) / nullif(sum(count(a.id)) over (), 0), 1) as share_pct,
    round(avg(extract(epoch from (now() - a.created_at)) / 86400)::numeric, 1) as avg_age_days
  from unnest(enum_range(null::public.application_status)) with ordinality as s(status, ord)
  left join public.applications a on a.status = s.status
  group by s.status, s.ord
  order by s.ord;
end;
$$;

revoke all on function public.report_applications_per_status() from public, anon;
grant execute on function public.report_applications_per_status() to authenticated;
