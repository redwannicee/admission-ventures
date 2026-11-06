# Branch and release workflow

- `main`: production. Protected: pull request + passing CI required, no direct pushes.
- `develop`: staging. Cloudflare builds a preview; point it at the staging Supabase project.
- `feature/<short-name>`: branch from `develop`, open a PR into `develop`.
- Release: PR `develop` → `main`, tag `vX.Y.Z`.
- **Database changes**: add a new numbered file in `supabase/migrations/` (never edit an applied migration). CI applies all migrations to a clean database and runs the authorization tests. Deploy with `supabase db push` to staging first, then production.
- **Edge Functions**: `supabase functions deploy <name>` after merging.
- Never commit `.env*` files or secrets; `.gitignore` excludes them.
