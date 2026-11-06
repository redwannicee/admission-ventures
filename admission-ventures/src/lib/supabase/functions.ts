import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./client";

export class ApiError extends Error {
  constructor(public code: string, public status = 0) { super(code); }
}

/** Calls an Edge Function and converts failures into ApiError with the server's error code. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status as number;
      const j = await error.context.json().catch(() => null) as { error?: string } | null;
      throw new ApiError(j?.error ?? "request_failed", status);
    }
    throw new ApiError("network_error");
  }
  return data as T;
}

/** Unwraps a PostgREST / RPC result, throwing ApiError carrying the database message code. */
export function must<T>(r: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (r.error) {
    const code = r.error.code === "42501" ? "forbidden" : r.error.message;
    throw new ApiError(code);
  }
  return r.data as T;
}
