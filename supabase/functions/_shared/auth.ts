// Authentication helpers. The caller's JWT is verified by Supabase Auth; roles are decided by the
// database (is_admin / is_super_admin read profiles.role and the JWT aal claim), never by the client.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { HttpError } from "./errors.ts";

export interface Caller { id: string; email: string; userClient: SupabaseClient; service: SupabaseClient; }

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`missing_env_${k}`);
  return v;
};

export function serviceClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticate(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(header)) throw new HttpError(401, "not_authenticated");
  const userClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: header } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "not_authenticated");
  return { id: data.user.id, email: data.user.email ?? "", userClient, service: serviceClient() };
}

/** Admin gate: evaluated by the database in the caller's own JWT context (role + MFA level). */
export async function requireAdmin(caller: Caller, superOnly = false): Promise<void> {
  const { data, error } = await caller.userClient.rpc(superOnly ? "is_super_admin" : "is_admin");
  if (error || data !== true) throw new HttpError(403, "forbidden");
}
