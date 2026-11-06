# Backup, restore and incident runbooks

## Backups
- Supabase takes daily backups on paid plans; Point-in-Time Recovery is a paid add-on. **Confirm which applies to your plan** before launch (spec §20).
- Weekly logical dump to a private, access-controlled location:
  `pg_dump "$DATABASE_URL" --format=custom --no-owner --file av-$(date +%F).dump`
  Restrict who can read dumps: they contain student personal data and financial records.
- Storage (PDFs, thumbnails): keep the original PDFs in a separate private archive; they are re-uploadable.
- Git holds code, migrations and functions. Secrets are held in Supabase/Cloudflare settings and a team password manager.

## Restore drill (do on staging; record the date and result here)
1. Create an empty staging project.
2. `supabase db push` (schema), then `pg_restore --data-only --disable-triggers -d "$STAGING_URL" av-<date>.dump` (or restore the dashboard backup).
3. Redeploy functions and secrets; point a preview site at it.
4. Verify: login works; a student sees only their enrolments; a paid order has its enrolment; an exam attempt result matches; `npm run test:db`-style negative checks still hold.
5. Record time taken. **Status: not yet performed.**

## Incident: payment gateway outage
1. Symptoms: Pay fails with "gateway not responding", orders stuck `pending`.
2. Post a site announcement (Admin → News). Do not grant access without proof of payment.
3. After recovery, reconcile: pending orders older than the outage vs the gateway dashboard. Genuine payments: grant access manually (reason recorded) or let a replayed IPN complete them.
4. Late payments on expired orders are intentionally rejected; handle them manually.

## Incident: database outage
1. Check the Supabase status page and project health. Site pages that need data will show error states with a retry button.
2. If it is our fault (bad migration): stop deploys, restore from backup/PITR to a new project if needed, repoint the two Cloudflare variables.
3. After recovery, run `select public.finalize_expired_attempts();` and `select public.expire_stale_orders();`.

## Incident: exam disruption
1. Deadlines are server-side, so student connection problems do not extend time. If a platform fault affected many students, extend by closing and reopening: set the exam's *Closes at* later and allow extra attempts (Admin → Exams → Edit), and announce it.
2. A student's saved answers are kept; reopening the exam resumes the open attempt.
3. Never edit scores by hand. If a question was wrong, fix it for future attempts; existing attempts use their frozen copy by design.

## Credentials and staff changes
Rotate the gateway password and Supabase keys when staff leave; remove their GitHub/Supabase/Cloudflare access; keep MFA on everywhere.
