import { ApiError } from "@/lib/supabase/functions";

const MESSAGES: Record<string, string> = {
  not_authenticated: "Please sign in to continue.",
  forbidden: "You do not have permission to do that.",
  not_enrolled: "You need to be enrolled in this course.",
  already_enrolled: "You are already enrolled in this course.",
  course_unavailable: "This course is not available right now.",
  order_not_found: "We could not find that order.",
  order_not_payable: "This order can no longer be paid.",
  order_expired: "This order has expired. Please start a new checkout.",
  too_many_payment_attempts: "Too many payment attempts for this order. Please contact support.",
  payments_not_configured: "Online payment is not available yet. Please try again later.",
  gateway_unavailable: "The payment gateway is not responding. Please try again in a moment.",
  gateway_init_failed: "The payment gateway is not responding. Please try again in a moment.",
  attempt_limit_reached: "You have used all attempts for this exam.",
  attempt_closed: "This attempt has already been submitted.",
  deadline_passed: "Time is up for this attempt.",
  quiz_not_open: "This exam has not opened yet.",
  quiz_closed: "This exam is closed.",
  attempt_not_found: "We could not find that attempt.",
  invalid_phone: "Enter a valid Bangladeshi mobile number, for example 01712345678.",
  network_error: "Network problem. Check your connection and try again.",
  internal_error: "Something went wrong on our side. Please try again.",
  request_failed: "The request failed. Please try again.",
  reason_required: "A reason is required.",
  expiry_must_be_in_future: "The expiry date must be in the future.",
  archive_instead_of_delete: "This item has history and cannot be deleted. Archive or unpublish it instead.",
  cannot_publish_quiz_without_questions: "Add at least one question before publishing the exam.",
  review_after_close_requires_closes_at: "Set a closing time to release the review after close.",
  invalid_options: "A question needs between two and six options.",
  invalid_correct_answer: "The correct answer must be one of the options.",
  duplicate_option_keys: "Option labels must be unique.",
  cannot_change_own_role: "You cannot change your own role.",
};

export function errorMessage(e: unknown): string {
  const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : "";
  if (MESSAGES[code]) return MESSAGES[code];
  if (/duplicate key|already exists/i.test(code)) return "That value is already in use.";
  if (/violates check constraint/i.test(code)) return "One of the values is not allowed. Please check the form.";
  if (/violates foreign key/i.test(code)) return "This item is still in use elsewhere.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(code)) return MESSAGES.network_error;
  return MESSAGES.internal_error;
}
