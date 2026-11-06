// POST { attempt_id, question_id, answer: {key} | null }
import { handle, json, readJson, unwrap } from "../_shared/http.ts";
import { authenticate } from "../_shared/auth.ts";
import { reqObject, reqUuid } from "../_shared/validation.ts";
import { HttpError } from "../_shared/errors.ts";

handle(async (req) => {
  const caller = await authenticate(req);
  const b = reqObject(await readJson(req));
  const answer = b["answer"] ?? null;
  if (answer !== null && (typeof answer !== "object" || Array.isArray(answer) || JSON.stringify(answer).length > 500)) throw new HttpError(400, "invalid_answer");
  return json(req, unwrap(await caller.service.rpc("save_quiz_answer", {
    p_student: caller.id, p_attempt: reqUuid(b, "attempt_id"), p_question: reqUuid(b, "question_id"), p_answer: answer,
  })));
});
