# Row Level Security and privilege model

Principle: **deny by default**. RLS is enabled on every table in `public`; `anon` and `authenticated` start with no privileges and receive explicit grants in `0003_rls_policies.sql`. Frontend route guards are a convenience and never replace this.

## Roles
| Role | Source | Notes |
|---|---|---|
| Guest | `anon` key | Published courses, modules and lesson *titles* only |
| Student | `profiles.role = 'student'` | Own profile, enrolments, orders, payments, progress, attempts |
| Instructor | `instructor` | Reserved for a later phase (no extra rights yet) |
| Admin | `admin` | Content, questions, quizzes, students, reports. Requires MFA (aal2) while `require_admin_mfa` is true |
| Super admin | `super_admin` | Admin plus role changes and refunds. MFA always required |

The role is read from `profiles.role`, never from `user_metadata`. `handle_new_user` forces new accounts to `student`. Clients cannot update `role` (column grant); only `admin_set_role` (super admin, MFA) can, and it is audited.

## Protected columns (revoked from API roles, reachable only via functions)
| Column | Reached via |
|---|---|
| `questions.correct_answer` | `admin_get_question_key` (admin); scoring reads the private attempt snapshot |
| `lessons.video_provider / video_ref / material_path` | `get_lesson_for_student` (called by the `get-protected-lesson` Edge Function) and `admin_get_lesson` |
| `quiz_answers.is_correct / awarded_marks` | `my_quiz_result`, subject to the quiz review policy |

## Who can write what
| Table | Students | Admins (aal2) | Service role (Edge Functions) |
|---|---|---|---|
| profiles | own `full_name`, `phone`, `avatar_path` | via role function | |
| courses | — | via `admin_manage_course` | yes |
| modules, lessons, categories, quizzes, quiz_questions, announcements | — | direct, through RLS | |
| questions | — | via `admin_save_question` | |
| enrollments | — | via `grant_enrollment` | yes |
| orders, order_items, payments, payment_events | — | read; refund via `admin_refund_order` (super admin) | `create_order`, `create_payment_record`, `process_payment_verification` |
| lesson_progress | via `save_lesson_progress` (checks access) | | |
| quiz_attempts, quiz_answers | read own | read | `start_quiz_attempt`, `save_quiz_answer`, `submit_quiz_attempt` |
| audit_logs | — | read | written by triggers |

## SECURITY DEFINER rules
Every definer function sets `search_path = public, pg_temp`, checks its caller (`auth.uid()` / `is_admin()`), and is granted only to the role that needs it. Service-role-only functions have `EXECUTE` revoked from `public`, `anon` and `authenticated`.

## Verifying
`npm run test:db` includes negative tests for each rule above (cross-student reads, role escalation, direct writes, protected columns, function privileges, RLS enabled on every table).
