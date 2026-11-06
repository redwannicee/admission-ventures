# QA report (spec §18, QA-01 … QA-14)

Status key: ✅ verified by automated test here · 🟡 partly verified, needs live check · ⬜ not done

| ID | Area | Status | Evidence / what remains |
|---|---|---|---|
| QA-01 | Auth | 🟡 | Forms, validation, password reset and MFA flows are built and type-checked; profile auto-creation and role forcing are tested in SQL. Sign-up, login, logout, reset email and session expiry need a live Supabase project (manual check list below). |
| QA-02 | RLS | ✅ | `10_authorization_and_workflows.sql` "QA-02" tests: A cannot read/rename B's profile, orders, payments, order items, enrolments, progress, attempts or results. |
| QA-03 | Roles | ✅ | "QA-03" tests: no self role change, admin RPCs refuse students, admin without MFA refused, ordinary admin cannot set roles, super admin needs MFA. |
| QA-04 | Catalog | ✅ | anon sees published courses only; protected columns give *permission denied*. |
| QA-05 | Enrolment | ✅ | duplicate purchase blocked; expired enrolment loses lesson access and course listing. |
| QA-06 | Payment forgery | ✅ | wrong amount, wrong currency, unknown transaction: rejected, no enrolment. Live gateway signature check: 🟡 (see `PAYMENTS.md`). |
| QA-07 | Idempotency | ✅ | same event id, id-less replay (digest), different event after payment: one transition, one enrolment. |
| QA-08 | Lessons | ✅ | non-enrolled student refused; free preview allowed; unpublished lesson closed; progress writes checked. |
| QA-09 | Question bank | ✅ | admin create/validate questions and categories; invalid options/keys rejected. |
| QA-10 | Exam | ✅ | server deadline, attempt limit, resume, answer validation, scoring (2 correct, 1 wrong at −0.25, 1 blank = 1.75), review policies, snapshot integrity. |
| QA-11 | Submission | ✅ | second submit returns the same score; answers locked after submit; other students cannot submit. |
| QA-12 | Mobile | 🟡 | All main screens rendered in Chromium at 360 px with mocked data: no horizontal overflow, exam timer/warning, answer saving and admin reports confirmed. Not tested on physical Android devices or slow networks. |
| QA-13 | Recovery | ⬜ | Procedure written in `RUNBOOKS.md`; the restore drill has **not** been performed. |
| QA-14 | Performance | ⬜ | Plan in `LOAD_TEST.md`; no load test was run. |

## Test inventory (all passing at delivery)
- Database: **170** checks (`npm run test:db`).
- Frontend/shared logic: **33** unit tests (`npm test`): MD5 vs Node crypto, SSLCommerz signature logic, validation, error mapping, exam timer (server-clock offset), route guards (including a regression for an admin-redirect race found during smoke testing), pagination/loading/empty/error states, checkout idempotency key.
- Static: ESLint and TypeScript clean for the app and the Edge Functions.

## Manual checks on a live staging project
1. Register → confirm email → log in → log out → reset password → session expires after sign-out elsewhere.
2. Admin: enrol MFA, log in again and complete the challenge; confirm a non-MFA session cannot open `/admin`.
3. Complete a sandbox payment (see `PAYMENTS.md`), including cancel and fail.
4. Take an exam on an Android phone: lock the screen mid-exam, return, confirm the timer and answers.
5. Open the anon REST endpoint for `lessons?select=video_ref`: expect *permission denied*.
