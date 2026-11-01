# Admission Ventures — Next.js rebuild

Bilingual (Bangla/English) EdTech platform. Next.js 15 App Router, Tailwind, shadcn-style UI,
Supabase (Postgres + RLS + Storage), deployed to Cloudflare via the OpenNext adapter.

## Run locally
```bash
cp .env.example .env.local   # fill in Supabase keys
npm install
npm run dev                  # Bangla at /, English at /en
npm run typecheck && npm run build
```

## Database
Run in the Supabase SQL editor, in order:
1. `supabase/migrations/0001_schema.sql`    tables, triggers, role helpers
2. `supabase/migrations/0002_rls.sql`       RLS policies + private `materials` bucket
3. `supabase/migrations/0003_functions.sql` coupon validation, mock purchase, exam engine
4. `supabase/migrations/0004_seed.sql`      sample courses and coupons (dev only)

Make yourself super admin after your first OTP login:
`update public.users set role = 'super_admin' where phone_number = '+8801XXXXXXXXX';`

## Phone OTP setup (Phase 2)
1. Supabase > Authentication > Providers > **Phone**: enable it. Set OTP length to 6 and expiry to 300s.
2. Supabase > Authentication > Hooks > **Send SMS**: choose HTTPS, URL `https://<your-domain>/api/sms-hook`,
   generate the secret and put it in `SEND_SMS_HOOK_SECRET`.
3. Put your gateway key in `SMS_API_KEY`. `src/app/api/sms-hook/route.ts` is written for Alpha SMS (sms.net.bd);
   confirm its field names against the gateway docs or swap in SSL Wireless.
4. Local dev without a gateway: leave `SMS_API_KEY` empty and the OTP is printed to the server console.
   (Also works with Supabase test numbers under Providers > Phone.)

## Landing page content
Courses, mentors and testimonials load from Supabase at build time. If Supabase is not configured or the tables are
empty, clearly-labelled sample content is shown instead. Add real mentors and testimonials rows before launch.

## Deploy (Cloudflare)
`npm run deploy` builds with `@opennextjs/cloudflare` and publishes a Worker with static assets.
Set the three Supabase env vars in the Cloudflare dashboard.

## Key decisions
- `/` is Bangla, `/en` is English. No Accept-Language redirects, so every URL caches as one response.
- Fonts are self-hosted (Inter + Hind Siliguri Bengali) with unicode-range slices.
- Only `Common` and `Nav` messages are sent to the client; page strings stay on the server.
- Students never read `questions` directly. Answers are exposed only by `get_exam_solutions`,
  after they submit AND the exam window closes. Scoring and timing are server-side.
- `mock_purchase_course` activates enrollments with no payment. Replace it before launch.
