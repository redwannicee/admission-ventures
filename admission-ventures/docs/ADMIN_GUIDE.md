# Admin guide

Sign in at `/login`. Admin accounts must complete two-step verification (authenticator app) the first time and on each new session; the app guides you.

## Courses and content (Admin → Courses)
1. **New course**: title, slug (URL), description, price in whole taka (0 = free), optional thumbnail.
2. **Content**: add modules, then lessons. For video, upload to YouTube as **Unlisted** and paste the link. Attach a PDF if needed (max 50 MB).
3. Tick **Published** on modules and lessons, then **Publish** the course. Unpublishing hides it from the catalogue but keeps existing students' access.
4. Courses with students or orders cannot be deleted; use **Archive**.

## Questions and exams
1. Admin → Questions: create categories, then questions (2–6 options, mark the correct one, optional explanation). Only **published** questions can be added to an exam.
2. Admin → Exams: create the exam (duration, attempts, open/close times, answer-review policy). Add questions, set marks and negative marks. Set **pass marks** and **Publish** (needs at least one question).
3. Review policy: *after submit*, *after close* (needs a closing time) or *never*.
4. Editing a question later does **not** change attempts already started (they use a frozen copy).

## Students and enrolment
Admin → Students: search, then **Enrolment** to grant or revoke access with a mandatory reason (audited). Super admins can change roles.

## Orders and payments
Admin → Orders: filter by status; open **Payments** for gateway attempts. Super admins can mark a paid order **Refunded** (removes access; return the money at the gateway). See `docs/PAYMENTS.md` for daily reconciliation.

## Reports and audit
Reports: students, enrolments, revenue, exam attempts, course and exam summaries. Audit: who changed what and when; entries cannot be edited or removed.
