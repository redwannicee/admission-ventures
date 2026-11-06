// POST { quiz_id } -> attempt (questions without answer keys; resumes an open attempt)
import { handle, json, readJson, unwrap } from "../_shared/http.ts";
import { authenticate } from "../_shared/auth.ts";
import { reqObject, reqUuid } from "../_shared/validation.ts";

handle(async (req) => {
  const caller = await authenticate(req);
  const quizId = reqUuid(reqObject(await readJson(req)), "quiz_id");
  return json(req, unwrap(await caller.service.rpc("start_quiz_attempt", { p_student: caller.id, p_quiz_id: quizId })));
});
