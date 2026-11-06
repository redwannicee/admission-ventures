# Environment variable inventory (no secrets in this file)

## Browser (Cloudflare Pages, public by design)
| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key. Safe in the browser **because** RLS protects the data |

Never put the service-role key, gateway passwords or any other secret in a `VITE_` variable: everything with that prefix is shipped to users.

## Edge Function secrets (Supabase → set with `supabase secrets set`)
| Name | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Injected automatically by Supabase |
| `SITE_URL` | Public site origin; payment return redirects go here |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list (defaults to `SITE_URL`) |
| `PUBLIC_FUNCTIONS_URL` | `https://<ref>.supabase.co/functions/v1`, used to build gateway callback URLs |
| `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD` | Gateway credentials (sandbox first) |
| `SSLCOMMERZ_LIVE` | `true` only for production |

## GitHub
CI needs no secrets (it builds with placeholder values and tests against a throwaway Postgres).

## Rotation
Rotate the gateway password, service-role key and any admin credentials whenever staff change (spec §20).
