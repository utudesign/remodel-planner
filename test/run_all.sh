#!/usr/bin/env bash
# Rebuilds a scratch Postgres, applies stub + migrations, runs SQL tests, exports fixtures, runs TS tests.
set -uo pipefail
S=/tmp/claude-0/-home-claude/da454c05-69cc-5ab7-b9b4-0c583dc4b039/scratchpad
PGBIN=/usr/lib/postgresql/16/bin
PSQL="psql -h /tmp -p 5544 -X"

if ! su postgres -c "$PGBIN/pg_ctl -D /tmp/pgdata status" >/dev/null 2>&1; then
  [ -d /tmp/pgdata/base ] || { mkdir -p /tmp/pgdata && chown postgres /tmp/pgdata && su postgres -c "$PGBIN/initdb -D /tmp/pgdata -A trust >/dev/null"; }
  su postgres -c "$PGBIN/pg_ctl -D /tmp/pgdata -l /tmp/pgdata/log -o '-k /tmp -p 5544' -w start" >/dev/null
fi
rm -rf /tmp/pkg /tmp/test && cp -r $S/pkg $S/test /tmp/ && chmod -R a+rwx /tmp/pkg /tmp/test
su postgres -c "$PSQL -q -c 'drop database if exists t' -c 'create database t'"
su postgres -c "$PSQL -v ON_ERROR_STOP=1 -d t -f /tmp/test/0000_supabase_stub.sql -f /tmp/pkg/supabase/migrations/0002_estimating.sql -f /tmp/pkg/supabase/migrations/0003_estimating_seed.sql -f /tmp/pkg/supabase/migrations/0004_deal_jacket.sql -f /tmp/test/run_tests.sql -f /tmp/test/run_deal_tests.sql -f /tmp/test/reset.sql -f /tmp/pkg/supabase/migrations/0005_compliance.sql -f /tmp/test/run_compliance_tests.sql -f /tmp/test/reset.sql -f /tmp/pkg/supabase/migrations/0006_sales_rep.sql -f /tmp/test/run_sales_tests.sql" > /tmp/test/out.txt 2>&1
echo "sql exit=$?  OK notices=$(grep -c 'NOTICE:  OK' /tmp/test/out.txt)  failures=$(grep -cE 'FAIL|ERROR' /tmp/test/out.txt)"
grep -E 'FAIL|ERROR' /tmp/test/out.txt

QA=$(su postgres -c "$PSQL -At -d t -c \"select id from quotes where status='approved' limit 1\"")
su postgres -c "$PSQL -At -d t -c \"
select jsonb_pretty(jsonb_build_object(
 '_note','Exported from Postgres (quote_totals view): 10x10 template with labor at 60/hr and the faucet at a 10% margin override. TS must match to the cent.',
 'assumptions',(select jsonb_build_object('targetMargin',target_margin,'contingencyRate',contingency_rate,'taxRate',tax_rate,'laborRateCents',labor_rate_cents) from quotes where id='$QA'),
 'lines',(select jsonb_agg(jsonb_build_object('name',name,'costCategory',cost_category,'qty',qty,'unitCostCents',unit_cost_cents,'usesLaborRate',uses_labor_rate,'marginOverride',margin_override,'taxable',taxable,'pricingMode',pricing_mode,'unitPriceCents',unit_price_cents) order by sort_order) from quote_line_items where quote_id='$QA'),
 'expected',(select jsonb_build_object('line_count',line_count,'direct_cost_cents',direct_cost_cents,'taxable_cost_cents',taxable_cost_cents,'lines_price_cents',lines_price_cents,'contingency_cost_cents',contingency_cost_cents,'tax_cost_cents',tax_cost_cents,'contingency_price_cents',contingency_price_cents,'tax_price_cents',tax_price_cents,'total_cost_cents',total_cost_cents,'total_price_cents',total_price_cents,'gross_profit_cents',gross_profit_cents,'gross_margin',gross_margin) from quote_totals where quote_id='$QA')))\"" > $S/pkg/lib/estimating/__fixtures__/ten-by-ten.json
Q=$(su postgres -c "$PSQL -At -d t -c \"set role authenticated; set request.jwt.claims='{\\\"sub\\\":\\\"user_designer\\\"}'; select create_quote_from_template('00000000-0000-0000-0000-00000000e001',(select id from quote_templates limit 1));\"" | tail -1)
su postgres -c "$PSQL -At -d t -c \"
select jsonb_pretty(jsonb_build_object(
 '_note','Exported from Postgres: the seeded 10x10 template at default settings. Used by ballpark.test.ts.',
 'assumptions',(select jsonb_build_object('targetMargin',target_margin,'contingencyRate',contingency_rate,'taxRate',tax_rate,'laborRateCents',labor_rate_cents) from quotes where id='$Q'),
 'takeoff',(select takeoff from quotes where id='$Q'),
 'lines',(select jsonb_agg(jsonb_build_object('name',li.name,'qty',li.qty,'unitCostCents',li.unit_cost_cents,'usesLaborRate',li.uses_labor_rate,'marginOverride',li.margin_override,'taxable',li.taxable,'qtySource',li.qty_source,'scalesWithCabinets',(c.name='Cabinets'),'pricingMode',li.pricing_mode,'unitPriceCents',li.unit_price_cents) order by li.sort_order) from quote_line_items li join catalog_categories c on c.id=li.category_id where li.quote_id='$Q'),
 'expectedTotalPriceCents',(select total_price_cents from quote_totals where quote_id='$Q')))\"" > $S/pkg/lib/estimating/__fixtures__/ten-by-ten-template.json
echo "template fixture total: $(python3 -c "import json;print(json.load(open('$S/pkg/lib/estimating/__fixtures__/ten-by-ten-template.json'))['expectedTotalPriceCents'])")"

rm -rf /tmp/tsrun/lib /tmp/tsrun/scripts /tmp/tsrun/supabase && cp -r $S/pkg/lib $S/pkg/scripts $S/pkg/supabase /tmp/tsrun/ && cd /tmp/tsrun && npx tsc -p . && echo TYPECHECK_OK; npx vitest run 2>&1 | tail -8
