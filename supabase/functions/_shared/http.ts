// Shared HTTP plumbing for Edge Functions: CORS, method guard, JSON and error mapping.
import { HttpError, mapDbError } from "./errors.ts";

export function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("SITE_URL") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const h: Record<string, string> = {
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
  if (allowed.includes(origin)) h["access-control-allow-origin"] = origin;
  return h;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "content-type": "application/json", "cache-control": "no-store" } });
}

export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 64_000) throw new HttpError(413, "payload_too_large");
  try { return await req.json(); } catch { throw new HttpError(400, "invalid_json"); }
}

/** Throws a mapped HttpError when a Supabase rpc/query result carries an error. */
export function unwrap<T>(r: { data: T | null; error: { message?: string; code?: string } | null }): T {
  if (r.error) throw mapDbError(r.error);
  return r.data as T;
}

export function handle(fn: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
    try {
      return await fn(req);
    } catch (e) {
      const err = e instanceof HttpError ? e : new HttpError(500, "internal_error");
      if (err.status >= 500) console.error("function_error", e instanceof Error ? e.message : String(e));
      return json(req, { error: err.code }, err.status);
    }
  });
}
