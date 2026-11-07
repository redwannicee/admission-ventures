# Admission Ventures

Online admission-preparation platform: recorded classes, PDF materials, timed exams, and secure checkout.
Built to *Admission Ventures – Full Technical Development Specification v1.0* ("Project Handshake").

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind, React Router (static SPA on Cloudflare Pages) |
| Backend | Supabase: Postgres + RLS, Auth, Storage, Edge Functions (Deno) |
| Video | YouTube Unlisted (embedded only after an access check) |
| Payment | SSLCommerz (hosted gateway) |
| Source of truth | GitHub; CI runs lint, type-check, unit tests, build and database tests |

## Repository layout
```
src/            app/ components/ layouts/ pages/{public,auth,student,admin}/
                features/{courses,lessons,enrollments,orders,payments,question-bank,examinations,analytics}/
                lib/{supabase,validation}/ hooks/ types/ utils/
supabase/       migrations/ (0001-0007)  functions/ (9 Edge Functions + _shared)  seed.sql  tests/
tests/          unit tests (vitest)
docs/           guides, ERD, RLS, security, QA, runbooks
```

## Quick start (local frontend)
```bash
npm ci
cp .env.example .env        # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Checks
| Command | What it runs |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` for the app, and for the Edge Functions via a Deno type shim |
| `npm test` | vitest: formatters, validation, MD5/SSLCommerz signature, exam timer, route guards |
| `npm run build` | type-check and production build to `dist/` |
| `npm run test:db` | applies all migrations and the seed to a throwaway Postgres and runs 170 authorization/workflow checks (needs `psql` and a server; see `supabase/tests/run.sh`) |

## Going live
Follow, in order: `docs/DEPLOYMENT_SUPABASE.md`, `docs/PAYMENTS.md` (sandbox checklist), `docs/DEPLOYMENT_CLOUDFLARE.md`, then `docs/QA.md` (items that still need a live environment).

## Documents
ERD `docs/ERD.md` · RLS `docs/RLS.md` · Security `docs/SECURITY.md` · Environment `docs/ENVIRONMENT.md` · Payments `docs/PAYMENTS.md` ·
Admin guide `docs/ADMIN_GUIDE.md` · Student guide `docs/STUDENT_GUIDE.md` · QA `docs/QA.md` · Runbooks `docs/RUNBOOKS.md` · Branching `docs/BRANCHING.md`

## Not in the MVP (spec "later phase")
Coupons, certificates (table exists, no UI), leaderboards, scheduled exams, bundles, live classes, instructor portal.

## Language (Bangla / English)

The site opens in Bangla; the **English / বাংলা** button in the header switches language and remembers the choice (`localStorage` key `av_lang`).
English text is the translation key: add a Bangla line to `src/i18n/bn.ts`. Missing keys fall back to English. Bangla-first copy (the About page) has its English in `src/i18n/en.ts`.
Course titles, descriptions and announcements come from the database and stay in the language they were typed in.
