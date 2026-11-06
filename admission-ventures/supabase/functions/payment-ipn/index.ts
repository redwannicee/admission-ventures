// Gateway callback. mode=ipn (server-to-server) or success|fail|cancel (browser return).
// Nothing is trusted from the request: signature check, then server-to-server validation, then a
// database function decides the state change (amount/currency/order state, idempotent).
// Deployed with verify_jwt = false (the gateway is not a logged-in user).
import { corsHeaders } from "../_shared/http.ts";
import { serviceClient } from "../_shared/auth.ts";
import { mapGatewayStatus, toIntegerAmount, validateTransaction, verifyIpnSignature } from "../_shared/sslcommerz.ts";

const redirect = (to: string) => new Response(null, { status: 303, headers: { location: to } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "ipn";
  const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const isBrowser = mode !== "ipn";
  const done = (status: string, order?: string, code = 200) => isBrowser
    ? redirect(`${site}/payment/result?status=${encodeURIComponent(status)}${order ? `&order=${encodeURIComponent(order)}` : ""}`)
    : new Response(JSON.stringify({ status }), { status: code, headers: { "content-type": "application/json" } });

  try {
    if (req.method !== "POST") return done("invalid", undefined, 405);
    const storeId = Deno.env.get("SSLCOMMERZ_STORE_ID"), storePass = Deno.env.get("SSLCOMMERZ_STORE_PASSWORD");
    if (!storeId || !storePass) return done("unconfigured", undefined, 503);
    const cfg = { storeId, storePass, live: Deno.env.get("SSLCOMMERZ_LIVE") === "true" };

    const form = await req.formData();
    const payload: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") payload[k] = v.slice(0, 2000);

    const tranId = payload["tran_id"] ?? "";
    const valId = payload["val_id"] ?? "";
    const db = serviceClient();
    const orderRef = tranId.replace(/-\d+$/, "");

    // 1. Cancel / failure returns from the browser carry no money: record and move on.
    if (mode === "cancel" || mode === "fail") {
      if (tranId) {
        await db.rpc("process_payment_verification", {
          p_gateway: "sslcommerz", p_tran_id: tranId, p_event_id: `${mode}:${tranId}`, p_event_type: mode.toUpperCase(),
          p_digest: mode, p_gateway_status: mode === "cancel" ? "cancelled" : "failed", p_amount: 0, p_currency: "BDT",
        });
      }
      return done(mode, orderRef);
    }

    // 2. Signature (when present) must be genuine. The validation call below is authoritative either way.
    if (payload["verify_sign"] && !verifyIpnSignature(payload, storePass)) return done("invalid_signature", undefined, 400);
    if (!valId || !tranId) return done("invalid", undefined, 400);

    // 3. Ask the gateway directly. Compare what IT says with our records, not what the browser said.
    const v = await validateTransaction(cfg, valId);
    if (v.tran_id !== tranId) return done("mismatch", undefined, 400);

    const { data, error } = await db.rpc("process_payment_verification", {
      p_gateway: "sslcommerz", p_tran_id: v.tran_id, p_event_id: valId, p_event_type: mode === "ipn" ? "IPN" : "RETURN",
      p_digest: `${v.status}:${v.amount}:${v.currency}`, p_gateway_status: mapGatewayStatus(v.status),
      p_amount: toIntegerAmount(v.amount), p_currency: (v.currency ?? "").toUpperCase(),
    });
    if (error) { console.error("verification_error", error.message); return done("error", orderRef, 500); }
    const outcome = (data as { outcome?: string; order_status?: string } | null);
    return done(outcome?.order_status === "paid" ? "success" : (outcome?.outcome ?? "pending"), orderRef);
  } catch (e) {
    console.error("payment_ipn_error", e instanceof Error ? e.message : String(e));
    return done("error", undefined, 500);
  }
});
