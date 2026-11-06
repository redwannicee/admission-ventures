# Security review report

Scope: this repository as delivered. Status is what was *verified here*, not assumed.

## Controls implemented and verified by automated tests
- RLS on every public table; explicit grants only; negative tests for cross-student access (QA-02).
- Role cannot come from user metadata or be changed by clients; admin RPCs refuse students, non-MFA admins, and (for roles/refunds) ordinary admins (QA-03).
- Answer keys, video references and material paths are never selectable by API roles; students receive them only through checked functions (QA-04, QA-08, Appendix B).
- Server-side scoring from a private attempt snapshot; server-side deadline; idempotent submission (QA-10/11).
- Payment: amount/currency/order-state verification, event de-duplication, status-transition guards, immutable order items (QA-06/07).
- Append-only audit log written by triggers; secrets and answer keys are never written to it.
- Edge Function error mapper never returns raw database errors; CORS allow-list; request size limit.

## Verified only by code review / type-check (needs a live environment)
- Edge Function runtime behaviour (no Deno runtime was available): types check and shared logic is unit tested, but functions have not been executed end to end.
- SSLCommerz integration (see `docs/PAYMENTS.md` checklist).
- Supabase Auth settings (email confirmation, redirect URLs, MFA enforcement through the dashboard).
- Storage policies against real Supabase Storage (tested only against a stub).

## Known limitations / recommended follow-ups
- Lesson video links are YouTube *Unlisted*: a signed-in student with access can see the video ID in the page. Unlisted is obscurity, not DRM (accepted by the spec).
- No rate limiting beyond Supabase defaults; add Cloudflare rules on `/functions/v1/*` if abuse appears.
- Exam anti-cheating (tab switching, proctoring) is out of scope.
- Run a third-party penetration test before large-scale launch.
- Rotate keys when staff change; keep dashboard MFA on for GitHub, Supabase, Cloudflare and the gateway.
