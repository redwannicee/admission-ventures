// POST { action, course_id?, payload? } ; admin (with MFA when required) only
import { handle, json, readJson, unwrap } from "../_shared/http.ts";
import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { reqEnum, reqObject, reqUuid } from "../_shared/validation.ts";
import { HttpError } from "../_shared/errors.ts";

const ACTIONS = ["create", "update", "publish", "unpublish", "archive", "unarchive"] as const;

handle(async (req) => {
  const caller = await authenticate(req);
  await requireAdmin(caller);
  const b = reqObject(await readJson(req));
  const action = reqEnum(b, "action", ACTIONS);
  const payload = b["payload"] ?? {};
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new HttpError(400, "invalid_payload");
  const courseId = action === "create" ? null : reqUuid(b, "course_id");
  return json(req, unwrap(await caller.service.rpc("admin_manage_course", {
    p_actor: caller.id, p_action: action, p_course_id: courseId, p_payload: payload,
  })));
});
