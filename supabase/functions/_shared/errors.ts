// Maps database / validation errors to HTTP responses without leaking internals.
export class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

const CONFLICT = new Set([
  "already_enrolled", "attempt_limit_reached", "attempt_closed", "order_not_payable", "order_expired",
  "order_is_free", "too_many_payment_attempts", "deadline_passed", "quiz_not_open", "quiz_closed",
]);
const NOT_FOUND = new Set(["order_not_found", "attempt_not_found", "course_not_found", "lesson_not_found", "quiz_not_found", "student_not_found"]);

export function mapDbError(err: { message?: string; code?: string } | null | undefined): HttpError {
  const msg = (err?.message ?? "").trim();
  const code = err?.code ?? "";
  if (code === "28000" || msg === "not_authenticated") return new HttpError(401, "not_authenticated");
  if (code === "42501" || msg === "forbidden" || msg === "not_enrolled" || msg.startsWith("permission denied")) {
    return new HttpError(403, msg === "not_enrolled" ? "not_enrolled" : "forbidden");
  }
  if (NOT_FOUND.has(msg)) return new HttpError(404, msg);
  if (CONFLICT.has(msg)) return new HttpError(409, msg);
  // Our own raise exception 'snake_case_code' messages are safe to return; anything else is not.
  if (/^[a-z][a-z0-9_]{2,60}$/.test(msg)) return new HttpError(400, msg);
  return new HttpError(500, "internal_error");
}
