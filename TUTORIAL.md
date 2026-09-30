# Build ApartmentHub Mini, step by step

This tutorial walks you through building the project in the order a real team would: data first, then security, then the pages on top. It assumes you know basic JavaScript/TypeScript and have seen React, but nothing about Supabase or the Next.js App Router.

**How to use it.** Every step matches a git branch in this repo (`git log --merges --reverse --oneline` lists them in order). For each step: read the goal and concepts, try to write the code yourself, then compare with the files listed. Each step ends with a **Check** so you know it works before moving on. Plan on a weekend.

---

## The big picture

```
  Browser (NL / EN)
        │
        ▼
  Next.js on Vercel ─── pages (Server Components) + Server Actions
        │
        ├── Supabase Auth      "who are you?"
        ├── Postgres + RLS     "what are you allowed to see and change?"
        └── Storage (private)  "your documents"
```

What happens when a tenant applies:

1. The tenant opens `/en/apply/<listing>`. Middleware checks the login cookie and sends them to `/en/login` if needed.
2. They submit the form. The browser sends it to a **Server Action** (a function that runs on the server).
3. The action validates the input with zod, uploads the file to the private bucket, then inserts a row in `applications`.
4. Postgres checks the **row-level security** policy: is `tenant_id` really the caller? Is the status `new`? If not, the insert is rejected, even if someone bypasses the UI.
5. The tenant lands on `/en/applications`, which shows only their rows, again because of RLS.

The most important idea of the whole project: **the browser is not trusted, the database is the security boundary.**

---

## Step 0 · Tools and accounts

Node 20+ (`node -v`), git, a GitHub account, a free [Supabase](https://supabase.com) account and a free [Vercel](https://vercel.com) account.

**Branch:** the first commit on `main` contains only the project skeleton.
**Files:** `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `.env.example`.

Worth knowing:

- `next.config.mjs` raises the Server Action body limit to 6 MB. The default is 1 MB, so document uploads would silently fail without it.
- `.env.example` documents the two variables the app needs. Real values go in `.env.local`, which git ignores.
- The `NEXT_PUBLIC_` prefix means the value is sent to the browser. That's fine for the anon key because RLS protects the data. **Never** give the `service_role` key that prefix.

---

## Step 1 · Create the Supabase project

No code, just the dashboard.

1. Create a project and save the database password.
2. Project Settings → API: copy the project URL and the anon/publishable key into `.env.local`.
3. Authentication → Sign In / Providers → Email: turn **off** "Confirm email" for development. (Leave it on in production and the app shows a "check your email" message.)

**Check:** `npm install && npm run dev` starts without errors (pages will show an error until the database exists).

---

## Step 2 · Data model

**Branch:** `feat/database-schema` · **Files:** `supabase/migrations/0001_schema.sql`, `supabase/seed.sql`

Open the Supabase **SQL Editor** and run `0001_schema.sql`, then `seed.sql`.

Concepts:

- **Enums** (`application_status`, `user_role`) make invalid states impossible. A typo like `'aproved'` is a database error, not a bug you find in production.
- **Foreign keys** (`applications.listing_id → listings.id`) keep data consistent. `on delete restrict` stops you deleting a listing that has applications.
- **`unique (tenant_id, listing_id)`** means one application per tenant per listing, enforced by the database rather than hoped for in code.
- **`default auth.uid()`** on `tenant_id`: Supabase's `auth.uid()` returns the id of the logged-in user, so the row owner is set by the database.
- **Triggers.** `handle_new_user()` creates a `profiles` row whenever someone signs up. It deliberately ignores any `role` the client sends, because otherwise anyone could sign up as an admin.
- **Migrations are numbered files.** Changes to the database are code, reviewed and versioned like everything else.

**Check:** Table Editor shows `profiles`, `listings` (4 rows), `applications`, `application_events`.

---

## Step 3 · Row-level security and storage

**Branch:** `feat/rls-and-storage` · **Files:** `0002_rls_policies.sql`, `0003_storage.sql`, `supabase/tests/rls_check.py`

Run both files in the SQL editor.

Concepts:

- **RLS** adds an invisible `WHERE` to every query. With RLS enabled and *no* policy, nobody can read anything. You then open access deliberately.
- **`using` vs `with check`.** `using` decides which existing rows you can see or touch. `with check` decides which new or changed row values are allowed. The insert policy uses `with check (tenant_id = auth.uid() and status = 'new')` so a tenant can't create an application that starts as `approved`.
- **`is_admin()` is `security definer`.** It runs with its owner's rights so it can read `profiles` without triggering the `profiles` policies again (which would recurse forever).
- **`(select auth.uid())`** instead of bare `auth.uid()` lets Postgres evaluate it once per query instead of once per row. It's a common Supabase performance tip.
- **What's missing matters.** `profiles` has no update policy, so no one can change their own role. `applications` has no delete policy, so no one can delete.
- **Storage** is also protected by RLS, on `storage.objects`. Files are saved as `<user id>/<random>-<name>`, and the policy compares the first folder of the path to `auth.uid()`.

**Check, the important one.** The SQL editor bypasses RLS (it runs as `postgres`), so to test as a user impersonate one inside a transaction:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<a tenant user id>', true);
select * from public.applications;   -- only that tenant's rows
rollback;
```

You can also run the automated version, which needs no Supabase project:

```bash
pip install pgserver psycopg2-binary
python supabase/tests/rls_check.py
```

---

## Step 4 · Two languages and the layout

**Branch:** `feat/i18n-and-layout`
**Files:** `lib/i18n/config.ts`, `lib/i18n/dictionaries.ts`, `lib/format.ts`, `app/[locale]/layout.tsx`, `components/Header.tsx`, `components/LanguageSwitcher.tsx`, `app/globals.css`

Concepts:

- **Locale in the URL.** The folder `app/[locale]/` is a *dynamic segment*, so `/nl/login` and `/en/login` are the same page with `locale = 'nl' | 'en'`. Separate URLs are good for SEO and shareable links.
- **Typed dictionaries.** `nl` is declared as `Dictionary` (the type of `en`), so a missing Dutch string fails the build. No runtime "missing translation" surprises.
- **`Intl`** formats euros and dates per language: `€ 1.850` in Dutch, `€1,850` in English.
- **Server vs Client Components.** By default everything in the App Router runs on the server. `Header` is a Server Component (it reads the user from cookies). `LanguageSwitcher` needs `usePathname()`, so it's marked `'use client'`. Keep client components small.
- In Next 15, route `params` are a **Promise**, so pages do `const { locale } = await params`.

**Check:** you can't see pages yet without middleware (Step 5), so run `npm run typecheck`. It should pass.

---

## Step 5 · Authentication

**Branch:** `feat/supabase-auth`
**Files:** `lib/supabase/env.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts` (project root), `lib/auth.ts`, `lib/actions/auth.ts`, `components/AuthForm.tsx`, `components/SubmitButton.tsx`, `app/[locale]/login/page.tsx`

Concepts:

- **Sessions live in cookies.** `@supabase/ssr` reads and writes them so Server Components, Server Actions and middleware all see the same user.
- **Middleware** (`middleware.ts`) runs before every page. Ours does two jobs: redirect `/apply` to `/nl/apply` (using the cookie or the browser's `Accept-Language`), and refresh the session and bounce signed-out users to the login page.
- **`getUser()`, not `getSession()`.** `getUser()` asks Supabase to verify the token. `getSession()` only reads the cookie, which can be forged.
- **Middleware is a convenience, not security.** Pages call `requireUser()` / `requireAdmin()` again. Always check authorization where the data is read.
- **Server Actions** (`'use server'`) are functions the browser can call like a form post. `useActionState` shows their returned errors in the form; `useFormStatus` disables the button while it runs.
- **Open-redirect protection.** After login we redirect to `?next=...`, but only if it starts with `/<locale>/`. Otherwise an attacker could craft a login link that sends you to their site.

**Check:** open `/`. It should redirect to `/nl` (or `/en`). Sign up on the login page. In Supabase → Table Editor → `profiles` your row should exist with role `tenant`.

---

## Step 6 · Listings page

**Branch:** `feat/listings-page` · **Files:** `app/[locale]/page.tsx`

A Server Component that queries `listings` directly with the Supabase client. There's no API route and no `useEffect`: the data is fetched on the server and sent as HTML.

Concepts:

- Anonymous visitors can read listings only because a policy explicitly allows `anon` to select active rows.
- The description column is chosen by locale (`description_nl` / `description_en`).
- If the query fails, the page shows a friendly message instead of crashing.

**Check:** `/en` shows four apartments with "Apply" buttons.

---

## Step 7 · The application form

**Branch:** `feat/apply-flow`
**Files:** `lib/validation.ts`, `lib/actions/applications.ts`, `components/ApplyForm.tsx`, `app/[locale]/apply/[listingId]/page.tsx`

Concepts:

- **Validate on the server.** Browser checks are for convenience, and anyone can skip them. The zod schema in `validation.ts` is the real gatekeeper. Its messages are *codes* (`too_short`, `invalid_email`) that the form translates, so errors are bilingual. The form uses `noValidate` so you can see those server messages instead of the browser's.
- **Order of operations** in `submitApplication`: validate → upload file → insert row. If the insert fails, the file is deleted so you don't leave orphans.
- **Database errors become friendly messages.** Postgres code `23505` (unique violation) becomes "You have already applied".
- **Re-filling the form.** React 19 clears uncontrolled forms after an action, so the action returns the submitted values and the form uses them as `defaultValue`.
- **File safety.** The name is sanitised, the type and size are checked, and the bucket itself also restricts them.
- `redirect()` must be called outside `try/catch` because it works by throwing.

**Check:** apply for a listing with a PDF. In Supabase you should see a row in `applications` and a file in Storage → `documents/<your user id>/...`. Try applying twice, and try a 10 MB file.

---

## Step 8 · "My applications"

**Branch:** `feat/tenant-applications`
**Files:** `lib/types.ts`, `lib/documents.ts`, `components/StatusBadge.tsx`, `app/[locale]/applications/page.tsx`

Concepts:

- **RLS in action.** The query has *no* `where tenant_id = ...`. It doesn't need one: the database only returns the caller's rows. Fewer filters in app code means fewer chances to forget one.
- **Signed URLs.** The bucket is private, so the server creates 5-minute links with `createSignedUrls`. Storage RLS still decides which paths you can sign.
- `lib/types.ts` holds `NEXT_STATUSES`, the allowed moves. The UI uses it to draw buttons; the database enforces it (Step 9).

**Check:** sign up a *second* tenant and apply. Each tenant must see only their own application. This is the demo that proves RLS works.

---

## Step 9 · Admin pipeline

**Branch:** `feat/admin-pipeline`
**Files:** `supabase/migrations/0004_status_workflow.sql`, `lib/actions/admin.ts`, `app/[locale]/admin/page.tsx`

Run `0004` in the SQL editor first, then make yourself an admin:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Concepts:

- **Defense in depth**, three layers for one button: `requireAdmin()` in the action, an RLS policy allowing only admins to update, and a trigger that rejects invalid transitions (`new → approved` fails).
- **An audit trail** (`application_events`) is filled by a trigger, so history is recorded no matter which client changes the data.
- **Forms without JavaScript.** Each button is a tiny `<form action={updateStatus}>`. It works even before the JS loads.
- The board groups rows by status in plain TypeScript. No client-side state at all.

**Check:** log in as the admin (you'll see "Pipeline" and "Report" in the header). Move an application forward. Then try to break it: in the SQL editor run `update applications set status = 'approved' where status = 'new';` and read the error.

---

## Step 10 · The SQL report

**Branch:** `feat/admin-report`
**Files:** `supabase/migrations/0005_reports.sql`, `app/[locale]/admin/report/page.tsx`

Concepts:

- The aggregation happens in **SQL**: `count`, `sum(...) over ()` for percentages, `avg` for the age, and `unnest(enum_range(...)) with ordinality` so statuses with zero rows still appear, in pipeline order.
- It's exposed as a Postgres **function** and called with `supabase.rpc('report_applications_per_status')`.
- The function is `security definer` (it needs to count everybody's rows), so it checks `is_admin()` itself and refuses everyone else. Rule of thumb: every `security definer` function needs its own permission check.
- `revoke ... from public, anon` removes the default execute permission.

**Check:** `/en/admin/report` shows one row per status with counts, share bars and average age. A tenant calling the function gets `Not authorized`.

---

## Step 11 · Continuous integration

**Branch:** `ci/github-actions` · **Files:** `.github/workflows/ci.yml`, `.github/pull_request_template.md`

On every PR GitHub runs `npm ci`, `npm run typecheck` and `npm run build`. A red check is the cheapest code review there is. The build uses placeholder env vars because it never contacts Supabase.

---

## Step 12 · Deploy to Vercel

1. Push the repo to GitHub (see "Git workflow" in the README for real PRs).
2. [vercel.com/new](https://vercel.com/new) → import the repo. Framework detection picks Next.js.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Settings → Environment Variables, then deploy.
4. In Supabase → Authentication → URL Configuration, set **Site URL** to your Vercel URL.

If a build fails, open the deployment's **Build Logs** and read the first error, not the last. The most common causes are a missing environment variable or a type error that only shows up on a clean build (run `npm run build` locally to reproduce).

**Check:** repeat the Step 7–9 checks on the live URL.

---

## Step 13 · Full end-to-end test

Use two browser profiles (or a private window) so you can be logged in as two people:

1. Tenant A applies → appears in "My applications" as *New*.
2. Tenant B applies for the same listing → sees only their own application.
3. Tenant A tries `/en/admin` → redirected home.
4. Admin moves A: *New → Screening → Viewing → Approved*. Tenant A refreshes and sees the badge change.
5. Admin rejects B. Report shows 1 approved, 1 rejected.
6. Switch the language on every page. Nothing should stay in the wrong language.

---

## Step 14 · Talking about it in an interview

Practice saying these in your own words:

- *"Why RLS instead of checking permissions in the API?"* One place to enforce rules, and it still holds if a new client or a bug bypasses the UI.
- *"What stops a tenant approving their own application?"* Three things: no update policy for tenants, the insert `with check` requiring status `new`, and the transition trigger.
- *"Server Action or API route?"* Server Actions for form mutations from our own UI (less boilerplate, progressive enhancement). Route handlers for webhooks and third-party callers.
- *"What would you do next?"* Typed Supabase client (`supabase gen types`), Playwright tests for the tenant/admin flows, email notifications on status change, pagination on the board, and a GDPR "delete my data" flow, since ID documents are sensitive.
- *"How did you use AI tools?"* Be honest: which parts you generated, and how you reviewed and tested them. The SQL rules here are covered by an automated script for exactly that reason.

## Stretch goals

- Add an `admin_notes` table with RLS and show notes on each card.
- Filter the pipeline by listing.
- Let admins create and deactivate listings from the UI.
- Send an email when a status changes (Supabase Edge Function + Resend).
- Playwright tests for Step 13.
