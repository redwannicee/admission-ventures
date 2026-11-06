# Cloudflare Pages deployment guide

1. Push this repository to GitHub.
2. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → choose the repository.
3. Build settings: framework preset **None**; build command `npm run build`; output directory `dist`; Node version 20 (set `NODE_VERSION=20`).
4. Environment variables (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — nothing else.
5. Deploy. `public/_redirects` provides the single-page-app fallback; `public/_headers` sets security headers (CSP, frame, referrer).
6. Set your custom domain, then update on Supabase: Auth Site URL and redirect URLs, and the `SITE_URL` / `ALLOWED_ORIGINS` secrets.
7. Branch workflow: `main` = production, `develop` = staging preview. Use a **staging Supabase project** for the preview environment so test payments never touch production data.

## Content Security Policy
`_headers` allows scripts only from the site itself, YouTube-nocookie for video frames, Supabase for API calls, and the SSLCommerz hosts as form targets. If you add analytics or fonts from another host, add that host explicitly and re-test.
