// POST { attempt_id } -> result. Scoring happens only in the database, from the attempt snapshot. Idempotent.
import { handle, json, readJson, unwrap } from "../_shared/http.ts";
import { authenticate } from "../_shared/auth.ts";
import { reqObject, reqUuid } from "../_shared/validation.ts";

handle(async (req) => {
  const caller = await authenticate(req);
  const attemptId = reqUuid(reqObject(await readJson(req)), "attempt_id");
  return json(req, unwrap(await caller.service.rpc("submit_quiz_attempt", { p_student: caller.id, p_attempt: attemptId })));
});
