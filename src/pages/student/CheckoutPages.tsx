import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Button, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { amEnrolled } from "@/features/enrollments/api";
import { getCourseById } from "@/features/courses/api";
import { createOrder, orderByReference } from "@/features/orders/api";
import { goToGateway, startPayment } from "@/features/payments/api";
import { checkoutKey, clearCheckoutKey } from "@/utils/idempotency";
import { errorMessage } from "@/utils/messages";
import { formatBDT } from "@/utils/format";
import type { Order } from "@/types/db";
import { useT } from "@/i18n";

export function CheckoutPage() {
  const { t } = useT();
  const { courseId = "" } = useParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const lock = useRef(false); // double-click protection independent of React state timing
  const state = useAsync(async () => {
    const course = await getCourseById(courseId);
    if (!course || !course.published) return null;
    return { course, enrolled: await amEnrolled(course.id) };
  }, [courseId]);

  async function pay() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setErr("");
    try {
      const order = await createOrder([courseId], checkoutKey(courseId));
      if (order.status === "paid") { clearCheckoutKey(courseId); nav(`/payment/result?status=success&order=${encodeURIComponent(order.order_reference)}`, { replace: true }); return; }
      const p = await startPayment(order.order_id);
      goToGateway(p.gateway_url);       // leaves the app; the lock stays on to stop repeat clicks
    } catch (e) {
      const msg = errorMessage(e);
      if (e instanceof Error && /order_expired|order_not_payable/.test(e.message)) clearCheckoutKey(courseId);
      setErr(msg); lock.current = false; setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("Checkout")} />
      <AsyncView state={state} isEmpty={(d) => d === null} empty={<EmptyState title={t("This course is not available")} action={<Link className="btn-primary btn-sm" to="/courses">{t("Browse courses")}</Link>} />}>
        {(d) => {
          if (!d) return null;
          const { course, enrolled } = d;
          if (enrolled) return <Alert kind="info">{t("You are already enrolled in this course.")} <Link className="font-semibold underline" to={`/learn/${course.slug}`}>{t("Start learning")}</Link></Alert>;
          return (
            <div className="card space-y-4 p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-ink-mute">{t("Course")}</p><h2 className="text-xl">{course.title}</h2></div><p className="font-display text-2xl text-brand-800">{formatBDT(course.price_amount)}</p></div>
              {err && <Alert>{err}</Alert>}
              <Button loading={busy} className="btn-accent w-full" onClick={pay}>{course.price_amount === 0 ? t("Enrol for free") : `Pay ${formatBDT(course.price_amount)} securely`}</Button>
              {course.price_amount > 0 && <p className="text-xs text-ink-mute">{t("You will be redirected to our payment gateway. Access opens after the payment is verified; the price is confirmed on the server.")}</p>}
            </div>);
        }}
      </AsyncView>
    </div>
  );
}

const POLL_MS = 3000, POLL_MAX = 20;
export function PaymentResultPage() {
  const { t } = useT();
  const [sp] = useSearchParams();
  const ref = sp.get("order") ?? "";
  const hint = sp.get("status") ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [tries, setTries] = useState(0);
  const [loadErr, setLoadErr] = useState<unknown>(null);

  // The redirect only hints at the outcome; the order status in the database is the truth.
  useEffect(() => {
    if (!ref) return;
    let stop = false;
    const tick = async (n: number) => {
      try {
        const o = await orderByReference(ref);
        if (stop) return;
        setOrder(o); setTries(n);
        if (o && ["paid", "failed", "cancelled", "expired", "refunded"].includes(o.status)) return;
        if (n < POLL_MAX) setTimeout(() => void tick(n + 1), POLL_MS);
      } catch (e) { if (!stop) setLoadErr(e); }
    };
    void tick(1);
    return () => { stop = true; };
  }, [ref]);

  if (!ref) return <EmptyState title={t("No order specified")} action={<Link className="btn-primary btn-sm" to="/orders">{t("My orders")}</Link>} />;
  const status = order?.status;
  const slugTo = "/dashboard";
  return (
    <div className="mx-auto max-w-lg">
      <div className="card space-y-4 p-6 text-center">
        {loadErr ? <Alert>{errorMessage(loadErr)}</Alert> :
         status === "paid" ? (<><CheckCircle2 className="mx-auto h-12 w-12 text-brand-600" aria-hidden /><h1 className="text-2xl">{t("Payment confirmed")}</h1><p className="text-ink-soft">{t("You are enrolled. Order {ref}.", { ref })}</p><Link to={slugTo} className="btn-primary">{t("Go to my courses")}</Link></>) :
         status && ["failed", "cancelled", "expired"].includes(status) ? (<><XCircle className="mx-auto h-12 w-12 text-red-700" aria-hidden /><h1 className="text-2xl">{t("Payment {status}", { status: t(status) })}</h1><p className="text-ink-soft">{hint === "cancel" ? t("No money was taken because you cancelled. You can try again from your orders.") : t("No money was taken for this attempt. You can try again from your orders.")}</p><Link to="/orders" className="btn-primary">{t("My orders")}</Link></>) :
         tries >= POLL_MAX ? (<><Clock className="mx-auto h-12 w-12 text-amber-deep" aria-hidden /><h1 className="text-2xl">{t("Still waiting for confirmation")}</h1><p className="text-ink-soft">{t("Your bank or wallet has not confirmed the payment yet. If money was deducted, access opens automatically once it is confirmed. Quote order {ref} if you contact support.", { ref })}</p><Link to="/orders" className="btn-primary">{t("My orders")}</Link></>) :
         (<><Spinner label={t("Confirming your payment")} /><p className="text-sm text-ink-mute">{t("Please do not close this page. Order {ref}.", { ref })}</p></>)}
      </div>
    </div>
  );
}
