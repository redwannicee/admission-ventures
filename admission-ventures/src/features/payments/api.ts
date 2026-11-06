import { callFunction } from "@/lib/supabase/functions";

/** Creates a payment attempt and returns the hosted gateway page URL. Amounts never come from the browser. */
export const startPayment = (orderId: string) => callFunction<{ gateway_url: string; tran_id: string }>("create-payment", { order_id: orderId });

/** Only https gateway pages are followed. */
export function goToGateway(url: string): void {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("gateway_init_failed");
  window.location.assign(u.toString());
}
