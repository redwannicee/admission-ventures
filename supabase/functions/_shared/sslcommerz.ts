// SSLCommerz client: session init, IPN signature check, server-to-server validation.
// UNVERIFIED against a live sandbox in this repository (no credentials were available):
// run the sandbox checklist in docs/PAYMENTS.md before enabling live mode.
import { md5 } from "./md5.ts";

export interface SslConfig { storeId: string; storePass: string; live: boolean; }

export const baseUrl = (c: SslConfig) => (c.live ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com");

/** verify_sign = md5( sorted "key=value" pairs of the keys named in verify_key, plus store_passwd=md5(pass) ). */
export function verifyIpnSignature(payload: Record<string, string>, storePass: string): boolean {
  const sign = payload["verify_sign"];
  const keyList = payload["verify_key"];
  if (!sign || !keyList) return false;
  const data: Record<string, string> = {};
  for (const k of keyList.split(",")) {
    if (k in payload) data[k] = payload[k];
  }
  data["store_passwd"] = md5(storePass);
  const str = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("&");
  return md5(str).toLowerCase() === sign.toLowerCase();
}

export type GatewayOutcome = "success" | "failed" | "cancelled" | "pending";

export function mapGatewayStatus(status: string | undefined): GatewayOutcome {
  switch ((status ?? "").toUpperCase()) {
    case "VALID": case "VALIDATED": return "success";
    case "FAILED": case "EXPIRED": case "UNATTEMPTED": return "failed";
    case "CANCELLED": return "cancelled";
    default: return "pending";
  }
}

/** Gateway amounts are decimals ("490.00"). Our amounts are integer BDT: anything fractional becomes -1 so it never matches. */
export function toIntegerAmount(v: string | number | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return -1;
  return Number.isInteger(n) ? n : -1;
}

export interface InitInput {
  tranId: string; amount: number; currency: string;
  successUrl: string; failUrl: string; cancelUrl: string; ipnUrl: string;
  customer: { name: string; email: string; phone: string };
  productName: string;
}

export async function initSession(c: SslConfig, i: InitInput): Promise<string> {
  const form = new URLSearchParams({
    store_id: c.storeId, store_passwd: c.storePass,
    total_amount: i.amount.toFixed(2), currency: i.currency, tran_id: i.tranId,
    success_url: i.successUrl, fail_url: i.failUrl, cancel_url: i.cancelUrl, ipn_url: i.ipnUrl,
    cus_name: i.customer.name || "Student", cus_email: i.customer.email, cus_add1: "N/A", cus_city: "Dhaka",
    cus_country: "Bangladesh", cus_phone: i.customer.phone || "01700000000",
    shipping_method: "NO", num_of_item: "1", product_name: i.productName.slice(0, 100),
    product_category: "Education", product_profile: "non-physical-goods",
  });
  const res = await fetch(`${baseUrl(c)}/gwprocess/v4/api.php`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form,
  });
  const json = await res.json().catch(() => null) as { status?: string; GatewayPageURL?: string } | null;
  if (!res.ok || !json || json.status !== "SUCCESS" || !json.GatewayPageURL) throw new Error("gateway_init_failed");
  return json.GatewayPageURL;
}

export interface ValidationResult { status: string; tran_id: string; amount: string; currency: string; }

/** Server-to-server validation: never trust the browser or the IPN body alone. */
export async function validateTransaction(c: SslConfig, valId: string): Promise<ValidationResult> {
  const url = new URL(`${baseUrl(c)}/validator/api/validationserverAPI.php`);
  url.searchParams.set("val_id", valId);
  url.searchParams.set("store_id", c.storeId);
  url.searchParams.set("store_passwd", c.storePass);
  url.searchParams.set("format", "json");
  const res = await fetch(url);
  const j = await res.json().catch(() => null) as Record<string, string> | null;
  if (!res.ok || !j || !j.status) throw new Error("gateway_validation_failed");
  return { status: j.status, tran_id: j.tran_id, amount: j.currency_amount ?? j.amount, currency: j.currency_type ?? j.currency };
}
