// POST { course_ids: uuid[], idempotency_key } -> order (free orders complete immediately)
import { handle, json, readJson, unwrap } from "../_shared/http.ts";
import { authenticate } from "../_shared/auth.ts";
import { idempotencyKey, reqObject, reqUuidArray } from "../_shared/validation.ts";

handle(async (req) => {
  const caller = await authenticate(req);
  const body = reqObject(await readJson(req));
  const ids = reqUuidArray(body, "course_ids");
  const key = idempotencyKey(body);
  // Prices come from the database; nothing monetary is accepted from the client.
  const order = unwrap(await caller.service.rpc("create_order", { p_student: caller.id, p_course_ids: ids, p_idempotency_key: key }));
  return json(req, order);
});
