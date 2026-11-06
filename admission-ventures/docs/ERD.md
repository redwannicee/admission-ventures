# Entity relationship diagram

Source of truth is `supabase/migrations/0001_schema.sql`. Amounts are integer BDT. All primary keys are UUIDs.

```mermaid
erDiagram
  profiles ||--o{ enrollments : has
  profiles ||--o{ orders : places
  profiles ||--o{ lesson_progress : records
  profiles ||--o{ quiz_attempts : takes
  profiles ||--o{ audit_logs : "acts in"
  courses ||--o{ course_modules : contains
  course_modules ||--o{ lessons : contains
  courses ||--o{ enrollments : grants
  courses ||--o{ order_items : "sold as"
  courses ||--o{ quizzes : "optionally scopes"
  courses ||--o{ announcements : "optionally targets"
  orders ||--|{ order_items : snapshots
  orders ||--o{ payments : "paid by"
  payments ||--o{ payment_events : logs
  lessons ||--o{ lesson_progress : tracked
  question_categories ||--o{ questions : groups
  questions ||--o{ quiz_questions : "used in"
  quizzes ||--o{ quiz_questions : has
  quizzes ||--o{ quiz_attempts : "attempted as"
  quiz_attempts ||--o{ quiz_answers : holds
  quiz_attempts ||--|| attempt_snapshots : "frozen copy (private schema)"
  profiles ||--o{ certificates : earns
  courses ||--o{ certificates : "issued for"
```

## Notes
- `private.attempt_snapshots` stores the exam as it was when the attempt started (including the answer key). It lives in the `private` schema, which API roles cannot use.
- `private.app_settings` holds `require_admin_mfa` (default `true`).
- `order_items` are immutable snapshots of title and price at purchase time.
- Courses, lessons, orders and questions that have history cannot be deleted (trigger `archive_instead_of_delete`); archive or unpublish instead.
- `audit_logs` is append-only (trigger blocks UPDATE/DELETE, even for the table owner).
