import { Fragment, type FormEvent, useState } from "react";
import { useAuth } from "@/app/AuthProvider";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, Modal, PageHeader, Pagination, Select, statusTone, TextInput } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { adminListOrders, refundOrder } from "@/features/orders/api";
import { errorMessage } from "@/utils/messages";
import { formatBDT, formatDate } from "@/utils/format";
import type { Order } from "@/types/db";

const SIZE = 20;
const STATUSES = ["", "pending", "paid", "failed", "cancelled", "expired", "refunded"];

function RefundModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    if (reason.length < 3) return setErr("Give a reason for the refund.");
    setBusy(true); setErr("");
    try { await refundOrder(order.id, reason); toast("success", "Order marked refunded and access removed"); onDone(); onClose(); }
    catch (er) { setErr(errorMessage(er)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Refund ${order.order_reference}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Alert kind="info">This records the refund and removes the student's access. Return the money through the payment gateway dashboard; this system does not move funds.</Alert>
        {err && <Alert>{err}</Alert>}
        <TextInput label="Reason" name="reason" required />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><Button loading={busy} className="btn-danger">Mark refunded</Button></div>
      </form>
    </Modal>
  );
}

export default function AdminOrders() {
  const { profile } = useAuth();
  const [status, setStatus] = useState(""); const [page, setPage] = useState(0);
  const [refund, setRefund] = useState<Order | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const state = useAsync(() => adminListOrders(status, page, SIZE), [status, page]);
  return (
    <>
      <PageHeader title="Orders & payments" sub="Use this to reconcile payments." />
      <div className="mb-4 max-w-xs"><Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>{STATUSES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}</Select></div>
      <AsyncView state={state} isEmpty={(d) => d.rows.length === 0} empty={<EmptyState title="No orders" />}>
        {(d) => <>
          <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Student</th><th>Items</th><th>Total</th><th>Status</th><th>Created</th><th className="text-right"> </th></tr></thead><tbody>
            {d.rows.map((o) => <Fragment key={o.id}>
              <tr>
                <td className="font-mono text-xs">{o.order_reference}</td><td>{o.profiles?.full_name ?? "—"}</td>
                <td>{o.order_items?.map((i) => i.item_title_snapshot).join(", ")}</td><td>{formatBDT(o.total_amount)}</td>
                <td><Badge tone={statusTone(o.status) as "green"}>{o.status}</Badge></td><td className="whitespace-nowrap">{formatDate(o.created_at, true)}</td>
                <td><div className="flex justify-end gap-1.5"><button className="btn-ghost btn-sm" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)}>Payments</button>
                  {profile?.role === "super_admin" && o.status === "paid" && <button className="btn-ghost btn-sm" onClick={() => setRefund(o)}>Refund</button>}</div></td>
              </tr>
              {open === o.id && <tr><td colSpan={7} className="bg-brand-50">
                {o.payments?.length ? <ul className="space-y-1 text-xs">{o.payments.map((p) => <li key={p.id} className="flex flex-wrap gap-x-4"><span className="font-mono">{p.gateway_transaction_id}</span><Badge tone={statusTone(p.status) as "green"}>{p.status}</Badge><span>{formatBDT(p.amount)}</span><span>verified {formatDate(p.verified_at, true)}</span></li>)}</ul> : <p className="text-xs text-ink-mute">No payment attempts.</p>}
              </td></tr>}
            </Fragment>)}
          </tbody></table></div>
          <Pagination page={page} pageSize={SIZE} total={d.total} onPage={setPage} />
        </>}
      </AsyncView>
      {refund && <RefundModal order={refund} onClose={() => setRefund(null)} onDone={state.reload} />}
    </>
  );
}
