#!/usr/bin/env bash
# Runs every migration, the seed and the SQL tests against a THROWAWAY plain PostgreSQL database.
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres ./supabase/tests/run.sh [dbname]
set -euo pipefail
DB="${1:-av_test}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/.."
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f "$HERE/00_supabase_stub.sql"
for f in "$ROOT"/migrations/*.sql; do echo "applying $(basename "$f")"; $P -f "$f" >/dev/null; done
$P -f "$ROOT/seed.sql" >/dev/null
OUT="$(psql -q -d "$DB" -f "$HERE/10_authorization_and_workflows.sql" 2>&1 || true)"
echo "$OUT" | sed -n '/=== RESULTS ===/,$p'
if echo "$OUT" | grep -q '^FAIL'; then exit 1; fi
if ! echo "$OUT" | grep -q '=== RESULTS ==='; then echo "$OUT" | tail -30; exit 1; fi
