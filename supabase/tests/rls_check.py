"""Checks the database rules without a Supabase project.

Starts a throwaway Postgres, stubs the parts of Supabase the migrations rely on
(auth.users, auth.uid(), storage.objects), applies every migration, then acts
as two tenants, an admin and an anonymous visitor and asserts what each may do.

Run:  pip install pgserver psycopg2-binary && python supabase/tests/rls_check.py
"""
import pathlib, sys, tempfile, uuid
import pgserver
import psycopg2

ROOT = pathlib.Path(__file__).resolve().parents[1]  # the supabase/ folder

STUBS = """
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  raw_user_meta_data jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$
  select string_to_array(name, '/')
$$;
grant usage on schema public, auth, storage to anon, authenticated;
"""

tmp = tempfile.mkdtemp()
srv = pgserver.get_server(tmp)
conn = psycopg2.connect(srv.get_uri())
conn.autocommit = True
cur = conn.cursor()

def run(sql):
    cur.execute(sql)

run(STUBS)
for f in sorted((ROOT / "migrations").glob("*.sql")):
    run(f.read_text())
    print("applied", f.name)
run((ROOT / "seed.sql").read_text())
run("grant select, insert, update on all tables in schema public to authenticated;"
    "grant select on public.listings to anon;"
    "grant select, insert, delete on storage.objects to authenticated;"
    "grant usage, select on all sequences in schema public to authenticated;")

# users (trigger creates profiles)
alice, bob, admin = (str(uuid.uuid4()) for _ in range(3))
for uid, name in [(alice, "Alice"), (bob, "Bob"), (admin, "Admin")]:
    cur.execute("insert into auth.users (id, raw_user_meta_data) values (%s, %s::jsonb)",
                (uid, '{"full_name": "%s", "role": "admin"}' % name))
run(f"update public.profiles set role = 'admin' where id = '{admin}'")

cur.execute("select role, count(*) from public.profiles group by role order by role")
print("roles after signup (metadata role must be ignored):", cur.fetchall())

def as_user(uid, role="authenticated"):
    run(f"set role {role}")
    run(f"select set_config('request.jwt.claim.sub', '{uid or ''}', false)")

def reset():
    run("reset role")

failures = []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok:
        failures.append(label)

def expect_error(label, sql):
    try:
        cur.execute(sql)
        check(label, False)
    except psycopg2.Error as e:
        check(f"{label} -> {e.pgerror.splitlines()[0]}", True)

cur.execute("select id from public.listings order by rent_eur limit 1")
listing = cur.fetchone()[0]

def apply_sql(uid, status="new"):
    return f"""insert into public.applications
      (tenant_id, listing_id, full_name, email, monthly_income_eur, household_size, move_in_date, status)
      values ('{uid}', '{listing}', 'Test Person', 't@example.com', 3000, 1, '2026-12-01', '{status}')"""

# anon can read listings but not applications
as_user(None, "anon")
cur.execute("select count(*) from public.listings"); check("anon sees listings", cur.fetchone()[0] == 4)
expect_error("anon cannot read applications", "select * from public.applications")
reset()

# tenants insert their own application
as_user(alice); run(apply_sql(alice)); reset()
as_user(bob);   run(apply_sql(bob));   reset()

as_user(alice)
cur.execute("select count(*) from public.applications"); check("alice sees only her own application", cur.fetchone()[0] == 1)
expect_error("alice cannot insert for bob", apply_sql(bob).replace("'Test Person'", "'Fake'"))
expect_error("alice cannot insert as approved", apply_sql(alice, "approved"))
expect_error("alice cannot apply twice for same listing", apply_sql(alice))
run("update public.applications set status = 'approved'")  # RLS: matches 0 rows
cur.execute("select status from public.applications"); check("alice cannot change her status", cur.fetchone()[0] == "new")
run("update public.profiles set role = 'admin' where id = '%s'" % alice)  # no policy -> 0 rows
cur.execute("select role from public.profiles where id = '%s'" % alice); check("alice cannot promote herself", cur.fetchone()[0] == "tenant")
expect_error("alice cannot call the report", "select * from public.report_applications_per_status()")
reset()

# storage policies
as_user(alice)
run(f"insert into storage.objects (bucket_id, name) values ('documents', '{alice}/a.pdf')")
expect_error("alice cannot upload into bob's folder", f"insert into storage.objects (bucket_id, name) values ('documents', '{bob}/x.pdf')")
cur.execute("select count(*) from storage.objects"); check("alice reads own docs", cur.fetchone()[0] == 1)
reset()
run(f"insert into storage.objects (bucket_id, name) values ('documents', '{bob}/b.pdf')")
as_user(alice)
cur.execute("select count(*) from storage.objects where name like '%b.pdf'"); check("alice cannot see bob's doc", cur.fetchone()[0] == 0)
reset()

# admin
as_user(admin)
cur.execute("select count(*) from public.applications"); check("admin sees all applications", cur.fetchone()[0] == 2)
cur.execute("select count(*) from storage.objects"); check("admin sees all documents", cur.fetchone()[0] == 2)
run("update public.applications set status = 'screening' where tenant_id = '%s'" % alice)
expect_error("invalid transition new -> approved is blocked",
             "update public.applications set status = 'approved' where tenant_id = '%s'" % bob)
run("update public.applications set status = 'viewing' where tenant_id = '%s'" % alice)
run("update public.applications set status = 'approved' where tenant_id = '%s'" % alice)
expect_error("approved is final", "update public.applications set status = 'rejected' where tenant_id = '%s'" % alice)
run("update public.applications set status = 'rejected' where tenant_id = '%s'" % bob)

cur.execute("select status, total, share_pct, avg_age_days from public.report_applications_per_status()")
rows = cur.fetchall()
print("report:", rows)
check("report lists all 5 statuses in pipeline order", [r[0] for r in rows] == ["new", "screening", "viewing", "approved", "rejected"])
check("report counts", {r[0]: r[1] for r in rows} == {"new": 0, "screening": 0, "viewing": 0, "approved": 1, "rejected": 1})

cur.execute("select count(*) from public.application_events")
check("events logged (2 created + 3 for alice + 1 for bob = 6)", cur.fetchone()[0] == 6)
reset()

as_user(alice)
cur.execute("select count(*) from public.application_events"); check("alice sees only her own history (4)", cur.fetchone()[0] == 4)
reset()

srv.cleanup()
print("\nFAILURES:", failures if failures else "none")
sys.exit(1 if failures else 0)
