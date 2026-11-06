// POST { order_id } -> { gateway_url } ; creates a payment attempt and an SSLCommerz session
import { handle, json, readJson, unwrap } from "../_shared/http.ts";
import { authenticate } from "../_shared/auth.ts";
import { reqObject, reqUuid } from "../_shared/validation.ts";
import { HttpError } from "../_shared/errors.ts";
import { initSession } from "../_shared/sslcommerz.ts";

handle(async (req) => {
  const caller = await authenticate(req);
  const orderId = reqUuid(reqObject(await readJson(req)), "order_id");
  const storeId = Deno.env.get("SSLCOMMERZ_STORE_ID"), storePass = Deno.env.get("SSLCOMMERZ_STORE_PASSWORD");
  const fnBase = Deno.env.get("PUBLIC_FUNCTIONS_URL");
  if (!storeId || !storePass || !fnBase) throw new HttpError(503, "payments_not_configured");
  const cfg = { storeId, storePass, live: Deno.env.get("SSLCOMMERZ_LIVE") === "true" };

  const pay = unwrap<{ payment_id: string; tran_id: string; amount: number; currency: string }>(
    await caller.service.rpc("create_payment_record", { p_student: caller.id, p_order_id: orderId, p_gateway: "sslcommerz" }));

  const { data: prof } = await caller.service.from("profiles").select("full_name, phone").eq("id", caller.id).maybeSingle();
  const { data: items } = await caller.service.from("order_items").select("item_title_snapshot").eq("order_id", orderId);
  const ret = (mode: string) => `${fnBase}/payment-ipn?mode=${mode}`;
  try {
    const url = await initSession(cfg, {
      tranId: pay.tran_id, amount: pay.amount, currency: pay.currency,
      successUrl: ret("success"), failUrl: ret("fail"), cancelUrl: ret("cancel"), ipnUrl: ret("ipn"),
      customer: { name: prof?.full_name ?? "", email: caller.email, phone: prof?.phone ?? "" },
      productName: (items ?? []).map((i) => i.item_title_snapshot).join(", ") || "Course",
    });
    unwrap(await caller.service.rpc("mark_payment_pending", { p_payment_id: pay.payment_id }));
    return json(req, { gateway_url: url, tran_id: pay.tran_id });
  } catch (e) {
    await caller.service.rpc("mark_payment_init_failed", { p_payment_id: pay.payment_id });
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, "gateway_unavailable");
  }
});
