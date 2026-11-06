// POST { student_id, course_id, action: grant|revoke, reason, expires_at? } ; admin only, audited
import { handle, json, readJson, unwrap } from "../_shared/http.ts";
import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { optIsoDate, reqEnum, reqObject, reqString, reqUuid } from "../_shared/validation.ts";

handle(async (req) => {
  const caller = await authenticate(req);
  await requireAdmin(caller);
  const b = reqObject(await readJson(req));
  return json(req, unwrap(await caller.service.rpc("grant_enrollment", {
    p_actor: caller.id, p_student: reqUuid(b, "student_id"), p_course: reqUuid(b, "course_id"),
    p_action: reqEnum(b, "action", ["grant", "revoke"] as const), p_reason: reqString(b, "reason", 3, 500),
    p_expires_at: optIsoDate(b, "expires_at"),
  })));
});
