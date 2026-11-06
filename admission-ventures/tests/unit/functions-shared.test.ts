import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { md5 } from "../../supabase/functions/_shared/md5.ts";
import { HttpError, mapDbError } from "../../supabase/functions/_shared/errors.ts";
import { idempotencyKey, isUuid, optIsoDate, reqEnum, reqString, reqUuid, reqUuidArray } from "../../supabase/functions/_shared/validation.ts";
import { mapGatewayStatus, toIntegerAmount, verifyIpnSignature } from "../../supabase/functions/_shared/sslcommerz.ts";

const nodeMd5 = (s: string) => createHash("md5").update(s).digest("hex");

describe("md5", () => {
  it("matches RFC 1321 vectors", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5("The quick brown fox jumps over the lazy dog")).toBe("9e107d9d372bb6826bd81d3542a419d6");
  });
  it("matches node crypto across padding boundaries and unicode", () => {
    for (const n of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 1000]) {
      const s = "x".repeat(n);
      expect(md5(s)).toBe(nodeMd5(s));
    }
    expect(md5("ক্লাস ৳৪৯০ ✓")).toBe(nodeMd5("ক্লাস ৳৪৯০ ✓"));
  });
});

describe("validation", () => {
  const id = "3f2b8a1e-5c4d-4e6f-9a7b-1c2d3e4f5a6b";
  it("validates uuids", () => {
    expect(isUuid(id)).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(isUuid(5)).toBe(false);
    expect(() => reqUuid({ a: "x" }, "a")).toThrowError(HttpError);
  });
  it("dedupes and bounds uuid arrays", () => {
    expect(reqUuidArray({ ids: [id, id] }, "ids")).toEqual([id]);
    expect(() => reqUuidArray({ ids: [] }, "ids")).toThrow();
    expect(() => reqUuidArray({ ids: [id, "bad"] }, "ids")).toThrow();
    expect(() => reqUuidArray({ ids: Array(11).fill(id) }, "ids")).toThrow();
  });
  it("checks strings, enums, dates and idempotency keys", () => {
    expect(reqString({ r: "  ok! " }, "r", 3, 10)).toBe("ok!");
    expect(() => reqString({ r: "ab" }, "r", 3, 10)).toThrow();
    expect(() => reqEnum({ a: "drop" }, "a", ["grant", "revoke"] as const)).toThrow();
    expect(optIsoDate({}, "d")).toBeNull();
    expect(() => optIsoDate({ d: "garbage" }, "d")).toThrow();
    expect(idempotencyKey({ idempotency_key: "abcdef0123456789" })).toBe("abcdef0123456789");
    expect(() => idempotencyKey({ idempotency_key: "short" })).toThrow();
    expect(() => idempotencyKey({ idempotency_key: "has spaces and is long enough" })).toThrow();
  });
});

describe("error mapping", () => {
  it("maps database errors to safe HTTP statuses", () => {
    expect(mapDbError({ message: "forbidden", code: "42501" }).status).toBe(403);
    expect(mapDbError({ message: "permission denied for table x" }).status).toBe(403);
    expect(mapDbError({ message: "not_authenticated" }).status).toBe(401);
    expect(mapDbError({ message: "attempt_limit_reached" }).status).toBe(409);
    expect(mapDbError({ message: "order_not_found" }).status).toBe(404);
    expect(mapDbError({ message: "invalid_options" }).status).toBe(400);
  });
  it("never leaks unexpected internals", () => {
    const e = mapDbError({ message: 'duplicate key value violates unique constraint "x" (secret)' });
    expect(e.status).toBe(500);
    expect(e.code).toBe("internal_error");
  });
});

describe("sslcommerz helpers", () => {
  const pass = "store@ssl";
  const sign = (p: Record<string, string>, keys: string[]) => {
    const d: Record<string, string> = {};
    keys.forEach((k) => (d[k] = p[k]));
    d.store_passwd = nodeMd5(pass);
    return nodeMd5(Object.keys(d).sort().map((k) => `${k}=${d[k]}`).join("&"));
  };
  const base = { tran_id: "AV-1-1", val_id: "v1", amount: "490.00", status: "VALID" };
  const keys = ["tran_id", "val_id", "amount", "status"];
  it("accepts a correct signature and rejects tampering", () => {
    const good = { ...base, verify_key: keys.join(","), verify_sign: sign(base, keys) };
    expect(verifyIpnSignature(good, pass)).toBe(true);
    expect(verifyIpnSignature({ ...good, amount: "1.00" }, pass)).toBe(false);
    expect(verifyIpnSignature({ ...good, verify_sign: "0".repeat(32) }, pass)).toBe(false);
    expect(verifyIpnSignature(good, "wrong-password")).toBe(false);
    expect(verifyIpnSignature({ ...base }, pass)).toBe(false);
  });
  it("maps gateway statuses and amounts safely", () => {
    expect(mapGatewayStatus("VALID")).toBe("success");
    expect(mapGatewayStatus("validated")).toBe("success");
    expect(mapGatewayStatus("FAILED")).toBe("failed");
    expect(mapGatewayStatus("CANCELLED")).toBe("cancelled");
    expect(mapGatewayStatus("RISK")).toBe("pending");
    expect(toIntegerAmount("490.00")).toBe(490);
    expect(toIntegerAmount("490.50")).toBe(-1);
    expect(toIntegerAmount("abc")).toBe(-1);
    expect(toIntegerAmount(undefined)).toBe(-1);
  });
});
