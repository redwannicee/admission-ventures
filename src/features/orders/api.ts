import { supabase } from "@/lib/supabase/client";
import { callFunction, must } from "@/lib/supabase/functions";
import type { Order } from "@/types/db";

export interface CreatedOrder { order_id: string; order_reference: string; status: string; total_amount: number; }
export const createOrder = (courseIds: string[], idempotencyKey: string) =>
  callFunction<CreatedOrder>("create-order", { course_ids: courseIds, idempotency_key: idempotencyKey });

const ORDER_COLS = "id, order_reference, student_id, currency, total_amount, status, expires_at, paid_at, created_at, order_items(id, course_id, item_title_snapshot, unit_price, quantity, line_total), payments(id, order_id, gateway, gateway_transaction_id, amount, status, verified_at, created_at)";
export const myOrders = async (): Promise<Order[]> =>
  must(await supabase.from("orders").select(ORDER_COLS).order("created_at", { ascending: false }).limit(100)) as unknown as Order[];
export async function orderByReference(ref: string): Promise<Order | null> {
  return must(await supabase.from("orders").select(ORDER_COLS).eq("order_reference", ref).maybeSingle()) as unknown as Order | null;
}

export async function adminListOrders(status: string, page: number, size: number): Promise<{ rows: Order[]; total: number }> {
  let q = supabase.from("orders").select(`${ORDER_COLS}, profiles(full_name)`, { count: "exact" }).order("created_at", { ascending: false }).range(page * size, page * size + size - 1);
  if (status) q = q.eq("status", status);
  const r = await q;
  if (r.error) must(r);
  return { rows: (r.data ?? []) as unknown as Order[], total: r.count ?? 0 };
}
export const refundOrder = async (orderId: string, reason: string) => must(await supabase.rpc("admin_refund_order", { p_order_id: orderId, p_reason: reason }));
