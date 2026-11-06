# Load test plan (QA-14) — NOT YET EXECUTED

No load test was run. Spec §2 explicitly excludes guaranteed concurrency without testing, so do this on **staging** before an exam day.

## Scenarios (k6 or similar, against staging only)
| Scenario | Target |
|---|---|
| Catalogue and course pages (anon reads) | p95 < 500 ms at the expected peak |
| Login burst | no auth rate-limit failures (check Supabase limits) |
| Exam start storm: N students start the same exam within 60 s | `start-quiz` p95 < 1.5 s; no duplicate attempts |
| Answer saving: each student saves ~1 answer per 20 s for the exam length | `save-quiz-answer` p95 < 500 ms |
| Submit at deadline: all students submit within 30 s | no lost submissions; scores correct |
| Payment callbacks: replay the same IPN 50 times concurrently | exactly one state change |

## Things to watch
Postgres CPU/connections, Edge Function cold starts and invocation limits for your plan, Auth email limits, and `pg_advisory_xact_lock` contention in `start_quiz_attempt` (it serialises per student+quiz only, not globally).

## Record results here
Date, tool, concurrency, p50/p95/p99, errors, bottlenecks, and the plan upgrades or indexes you decided on.
