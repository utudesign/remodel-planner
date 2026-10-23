#!/usr/bin/env bash
# SQL tests on a plain Postgres 16 (not the Supabase stack: these tests create
# their own stand-ins for Supabase's auth and storage schemas).
#
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/test-db.sh
#
# Pass 1: the handoff's own tests (test/run_*.sql), in the handoff's order, but on
#         the REAL 0001_core.sql instead of test/0000_supabase_stub.sql.
# Pass 2: every migration + supabase/seed.sql + supabase/tests/rules_test.sql.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
PSQL="psql -X -v ON_ERROR_STOP=1 -q"
M=supabase/migrations
OUT=$(mktemp -d)
fail=0

# The handoff tests \i the price list from /tmp/pkg (where they were written).
ln -sfn "$ROOT" /tmp/pkg

fresh() { $PSQL -d postgres -c "drop database if exists $1" -c "create database $1" >/dev/null 2>&1; }

echo "== pass 1: handoff tests on 0001_core"
fresh rp_handoff
$PSQL -d rp_handoff \
  -f test/0000_supabase_internals.sql -f $M/0001_core.sql \
  -f $M/0002_estimating.sql -f $M/0003_estimating_seed.sql -f $M/0004_deal_jacket.sql \
  -f test/run_tests.sql -f test/run_deal_tests.sql -f test/reset.sql \
  -f $M/0005_compliance.sql -f test/run_compliance_tests.sql -f test/reset.sql \
  -f $M/0006_sales_rep.sql -f test/run_sales_tests.sql > "$OUT/handoff.txt" 2>&1
rc=$?
ok=$(grep -c 'NOTICE:  OK' "$OUT/handoff.txt")
bad=$(grep -cE 'FAIL|ERROR' "$OUT/handoff.txt")
echo "   exit=$rc ok=$ok failures=$bad (expected ok=41)"
if [ $rc -ne 0 ] || [ "$bad" -ne 0 ] || [ "$ok" -lt 41 ]; then
  grep -nE 'FAIL|ERROR' "$OUT/handoff.txt" | head -20; fail=1
fi

echo "== pass 2: all migrations + seed + rules_test"
fresh rp_rules
args=(-f test/0000_supabase_internals.sql)
for f in $M/*.sql; do args+=(-f "$f"); done
args+=(-f supabase/seed.sql -f supabase/seed_timberpeak_demo.sql -f supabase/tests/rules_test.sql)
$PSQL -d rp_rules "${args[@]}" > "$OUT/rules.txt" 2>&1
rc=$?
if [ $rc -ne 0 ] || grep -qE 'FAIL|ERROR' "$OUT/rules.txt"; then
  grep -nE 'FAIL|ERROR' "$OUT/rules.txt" | head -20; tail -5 "$OUT/rules.txt"; fail=1
else
  grep -c 'NOTICE:  OK' "$OUT/rules.txt" | xargs echo "   ok="
  tail -1 "$OUT/rules.txt"
fi

echo "logs: $OUT"
exit $fail
