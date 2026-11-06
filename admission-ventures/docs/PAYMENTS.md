# Payment and reconciliation guide

## Flow
1. Student clicks Pay → `create-order` (price read from the database; idempotency key prevents duplicate orders) → `create-payment` creates a payment attempt and an SSLCommerz session.
2. The browser is redirected to the gateway's hosted page.
3. The gateway calls `payment-ipn` (server-to-server) and redirects the browser back (`mode=success|fail|cancel`).
4. `payment-ipn` never trusts the request body. It checks the signature (`verify_sign`/`verify_key`), then calls the gateway's **validation API** with `val_id`, compares `tran_id`, and passes the *gateway-reported* amount and currency to `process_payment_verification`.
5. The database function re-checks amount, currency and order state, de-duplicates the event, marks the payment and order paid, and activates the enrolment, all in one transaction.
6. The browser lands on `/payment/result`, which polls the order status (the redirect only hints at the outcome).

## Guarantees (tested in `npm run test:db`)
Forged or mismatched amount/currency → rejected and logged; unknown transaction → refused; repeated callback → one state transition; paid orders cannot move back; a failed order cannot be paid; late payment on an expired order is rejected for manual reconciliation.

## Sandbox checklist (REQUIRED before live mode; not yet performed)
The SSLCommerz client code (`supabase/functions/_shared/sslcommerz.ts`) was written from the public integration documentation and unit-tested for signature logic, but has **not** been run against the sandbox. Before going live:
- [ ] Obtain sandbox store credentials; set secrets with `SSLCOMMERZ_LIVE=false`.
- [ ] Pay successfully: order becomes `paid`, enrolment appears, result page shows success.
- [ ] Cancel and fail: order is not paid; retry works from Orders.
- [ ] Confirm the `verify_sign` check passes on a genuine IPN (field names/ordering match the documentation for your account).
- [ ] Confirm `currency_amount`/`amount` fields from the validation API match what the code reads, and that amounts are whole taka.
- [ ] Replay the same IPN twice: exactly one state change.
- [ ] Tamper with the amount in a request: rejected.
- [ ] Only then switch to live credentials and `SSLCOMMERZ_LIVE=true`.

## Daily reconciliation
1. Admin → Orders: filter `pending` older than 30 minutes and look at the Rejected payment events tile on Reports.
2. Compare paid orders against the gateway merchant dashboard settlement report. Differences go to the incident list.
3. Money received for an order that is `expired`/`failed`: grant access with Admin → Students → Enrolment (reason recorded in the audit log) **or** refund at the gateway.
4. Refunds: return the money in the gateway dashboard, then super admin uses Orders → Refund to mark the order `refunded` and remove access. The system does not move funds.
