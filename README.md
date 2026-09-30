# ApartmentHub Mini

A small, bilingual (Dutch/English) rental application app built as a portfolio project. Tenants browse apartments, apply and upload a document. Staff move applications through a pipeline and see a report. It mirrors the kind of work in a full-stack role on a rental platform: Next.js, Supabase, Postgres row-level security and Vercel.

> Not affiliated with any real company. It's a learning project.

**New to this? Read [TUTORIAL.md](./TUTORIAL.md).** It rebuilds the project step by step and explains every concept.

## Features

| Area | What it does |
| --- | --- |
| Bilingual UI | `/nl/...` and `/en/...` routes, typed dictionaries (a missing translation is a compile error), language picked from cookie or browser |
| Auth | Email + password sign-up and login with Supabase Auth, session refreshed in middleware |
| Apply | Validated form (zod, errors in both languages), document upload to a private storage bucket, duplicate applications rejected |
| Tenant area | Tenants see only their own applications, with short-lived signed links to their documents |
| Admin pipeline | Board with `new → screening → viewing → approved`, or `rejected`; every change is logged |
| Report | "Applications per status" computed in SQL and called through `rpc()` |

## Stack

Next.js 15 (App Router, Server Components, Server Actions) · React 19 · TypeScript · Supabase (Postgres, Auth, Storage) · zod · plain CSS · Vercel

## Security model

The browser talks to Supabase with the public anon key, so **the database is the security boundary**, not the UI.

| Rule | Enforced by |
| --- | --- |
| Tenants read/insert only their own applications | RLS policies (`0002_rls_policies.sql`) |
| Tenants cannot create an application as `approved`, or edit one | RLS `with check` and admin-only update policy |
| Nobody can promote themselves to admin | `profiles` has no update policy; the sign-up trigger ignores metadata roles |
| Documents are private, in the owner's folder | Storage policies (`0003_storage.sql`) + signed URLs |
| Statuses only move along the allowed path | Trigger (`0004_status_workflow.sql`) |
| Only admins can read the report | The SQL function checks `is_admin()` |

`supabase/tests/rls_check.py` asserts all of these against a throwaway Postgres (no Supabase project needed).

## Run it locally

Requires Node 20+ and a free [Supabase](https://supabase.com) project.

1. **Database.** In the Supabase SQL editor, run the files in `supabase/migrations/` in order (`0001` to `0005`), then `supabase/seed.sql`.
2. **Auth.** Authentication → Sign In / Providers → Email: turn off "Confirm email" for local development (otherwise sign-up asks you to confirm by email first).
3. **Env vars.** `cp .env.example .env.local` and fill in your project URL and anon/publishable key (Project Settings → API).
4. **Install and start.**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.
5. **Make yourself an admin.** Sign up in the app, then run in the SQL editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

## Deploy to Vercel

1. Push this repo to GitHub and import it on [vercel.com/new](https://vercel.com/new).
2. Add the two environment variables from `.env.example` (Project Settings → Environment Variables).
3. Deploy. Then in Supabase → Authentication → URL Configuration, set **Site URL** to your Vercel URL and add it to the redirect URLs.

## Project structure

```
app/[locale]/        pages: home, login, apply/[listingId], applications, admin, admin/report
components/          Header, AuthForm, ApplyForm, StatusBadge, ...
lib/actions/         Server Actions: auth, applications, admin
lib/supabase/        server client + middleware session refresh
lib/i18n/            locales and typed dictionaries
lib/validation.ts    zod schema and file checks
middleware.ts        language routing + auth redirect
supabase/migrations/ schema, RLS, storage, workflow trigger, report function
supabase/tests/      RLS assertions against a throwaway Postgres
```

## Git workflow

Each feature lives on its own branch and was merged with a merge commit, so `git log --graph --oneline` reads like a series of pull requests. The branches are kept.

To get real pull request pages on GitHub:

```bash
git remote add origin git@github.com:<you>/apartmenthub-mini.git

# 1. publish only the first commit as main
git push origin "$(git rev-list --max-parents=0 main)":refs/heads/main

# 2. publish the feature branches
git push origin $(git branch --format='%(refname:short)' | grep -v '^main$')

# 3. on GitHub, open a PR per branch and merge them in this order:
git log --merges --reverse --format='%s'

# 4. finally, sync your local main with GitHub's
git fetch origin && git checkout main && git reset --hard origin/main
```

## Known limits

- No automated tests for the Next.js code yet (the SQL rules are tested). Playwright end-to-end tests would be the next step.
- Supabase clients are untyped. `supabase gen types typescript` would give end-to-end types.
- No email notifications, rate limiting or virus scanning of uploads.
