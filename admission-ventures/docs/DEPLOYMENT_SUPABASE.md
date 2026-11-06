# Supabase deployment guide

Do this on a **staging** project first, then repeat for production.

1. **Create the project** (choose a region close to your students; Singapore is typical for Bangladesh). Note the project ref, URL and anon key.
2. **Install the CLI** and link: `supabase login` then `supabase link --project-ref <ref>`.
3. **Apply migrations:** `supabase db push`. This applies `supabase/migrations/0001…0007` in order. Do **not** run `seed.sql` on production (it is synthetic sample content for development/staging).
4. **Auth settings** (Dashboard → Authentication):
   - Enable email sign-up and email confirmation; set the Site URL to your site and add `https://<site>/reset-password` and `https://<site>/login` to Redirect URLs.
   - Enable **MFA (TOTP)**. Admin accounts must enrol (the app walks them through it).
   - Configure a real SMTP provider before launch (the built-in mailer is rate-limited).
5. **Storage:** migration `0003` creates `course-materials` (private) and `course-thumbnails` (public read, admin write). Confirm both exist and that the bucket policies are present.
6. **Edge Function secrets:** copy `supabase/functions/.env.secrets.example` to `.env.secrets`, fill it, then `supabase secrets set --env-file supabase/functions/.env.secrets`.
7. **Deploy functions:** `supabase functions deploy` (deploys all nine; `payment-ipn` is configured with `verify_jwt = false` in `config.toml`).
8. **Create the first super admin:** register normally, then in the SQL editor run
   `update public.profiles set role = 'super_admin' where id = (select id from auth.users where email = 'you@example.com');`
   Then log in and complete MFA enrolment. After this, roles are managed in the app (Admin → Students).
9. **Schedule maintenance jobs** (Dashboard → Database → Cron, or `pg_cron`):
   - `select public.expire_stale_orders();` every 10 minutes
   - `select public.expire_enrollments();` hourly
   - `select public.finalize_expired_attempts();` every 5 minutes
   These are service-role functions; run them from a cron job that connects as `postgres`.
10. **Backups:** see `docs/RUNBOOKS.md`. Confirm your plan's backup/PITR level before launch.

## Verify
- Open `https://<ref>.supabase.co/rest/v1/profiles` with the anon key: expect an empty result or permission error, never data.
- Run the SQL checks in `docs/QA.md` against staging.
