import { HttpError } from "./errors.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function reqObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "invalid_body");
  return body as Record<string, unknown>;
}
export function reqUuid(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (!isUuid(v)) throw new HttpError(400, `invalid_${key}`);
  return v;
}
export function reqUuidArray(o: Record<string, unknown>, key: string, max = 10): string[] {
  const v = o[key];
  if (!Array.isArray(v) || v.length < 1 || v.length > max || !v.every(isUuid)) throw new HttpError(400, `invalid_${key}`);
  return [...new Set(v as string[])];
}
export function reqString(o: Record<string, unknown>, key: string, min: number, max: number): string {
  const v = o[key];
  if (typeof v !== "string" || v.trim().length < min || v.length > max) throw new HttpError(400, `invalid_${key}`);
  return v.trim();
}
export function optString(o: Record<string, unknown>, key: string, max: number): string | null {
  const v = o[key];
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > max) throw new HttpError(400, `invalid_${key}`);
  return v.trim();
}
export function reqEnum<T extends string>(o: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const v = o[key];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) throw new HttpError(400, `invalid_${key}`);
  return v as T;
}
export function optIsoDate(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new HttpError(400, `invalid_${key}`);
  return new Date(v).toISOString();
}
export function idempotencyKey(o: Record<string, unknown>): string {
  const v = o["idempotency_key"];
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(v)) throw new HttpError(400, "invalid_idempotency_key");
  return v;
}
