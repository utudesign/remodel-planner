# Push, run and deploy

Times are US Eastern. **Stripe: none.** The app never takes client money (master prompt rule), so there is
no Stripe account, key or webhook to set up. Add Stripe steps only if online payments are ever added.

## 0. What talks to what

```
iPhone (home-screen app) ──► Vercel (Next.js 16) ──► Supabase Postgres (RLS on every table) + Storage (deal-files)
        │                        │   └── every query carries the Clerk session token; Supabase verifies it
        │                        │       (third-party auth); users.clerk_id → company + role
        └──► Clerk (sign-in)     ├── Vercel cron 19:30 + 20:30 UTC Mon–Fri → /api/cron → 3:30 PM digest
                                 └── Web Push (VAPID) → your phone
Public pages (no login): /l/<slug> lead form · /book/<token> visit booking · /q/<token> client estimate
```

## 1. Push to GitHub (on your Mac)

The code is at `~/Claude/remodel-planner`, already a git repo with `origin` = `github.com/utudesign/remodel-planner`.

```bash
cd ~/Claude/remodel-planner
git log --oneline | head -5      # newest: Step 3 …
git push -u origin main
```

If GitHub refuses because the remote already has commits you don't need (e.g. an auto-created README),
look at them first (`git fetch && git log origin/main`). Only then decide whether to `git pull --rebase`
or overwrite.

## 2. Run it locally (optional, needs Docker Desktop or OrbStack)

```bash
pnpm install
cp .env.example .env.local                     # fill in as you go
echo "CLERK_FRONTEND_API_DOMAIN=<your-app>.clerk.accounts.dev" > supabase/.env
pnpm db:start                                  # prints API URL + anon + service_role keys → .env.local
pnpm db:reset                                  # migrations 0001–0011 + demo data + TimberPeak list
pnpm dev                                       # http://localhost:3000
```

First sign-in creates **your own** account (empty, with RenoDesign + the two placeholder plans and the
TimberPeak list). The demo deals live in a separate demo company. To look at them instead, run this in
Supabase Studio (http://127.0.0.1:54323 → SQL) after signing in once:

```sql
-- point the demo owner row at your Clerk user, and drop the empty account the app made for you
delete from public.companies where id = (select company_id from public.users where clerk_id = 'user_XXXX');
update public.users set clerk_id = 'user_XXXX' where clerk_id = 'seed_tugu';
```

(`user_XXXX` = your id in Clerk → Users.) Sign out and in again: 8 deals, a visit tonight, $962.50 owed.

Checks:

```bash
pnpm check                                       # lint + typecheck + Vitest + build
PGHOST=/tmp PGPORT=5432 scripts/test-db.sh       # SQL tests on a plain Postgres 16 (not the Supabase stack)
```

## 3. Production

### Clerk (production instance)

1. dashboard.clerk.com → your app → **Production** → add your domain → DNS records.
2. **Organizations: leave OFF.** (Accounts are per person; the database links a login to a company.)
3. Configure → **Restrictions → Sign-up mode: Restricted** (or Allowlist your email). Only you sign up;
   Crystal comes in through an invite later.
4. Integrations → **Supabase → Activate**. Copy the Clerk domain it shows.
5. API keys → `pk_live_…`, `sk_live_…`.
6. Webhooks → Add endpoint `https://<your-domain>/api/webhooks/clerk`, events `user.updated`, `user.deleted`
   → copy the signing secret (`whsec_…`). Optional: sign-in works without it.

### Supabase

1. supabase.com → New project, region **East US (N. Virginia)**. Save the DB password.
2. Authentication → Sign In / Providers → **Third-party auth → Add provider → Clerk** → paste the
   production Clerk domain.
3. Push the schema (demo data is not pushed):
   ```bash
   pnpm supabase login
   pnpm supabase link --project-ref <ref>
   pnpm supabase db push           # 0001–0011; creates the private deal-files bucket too
   ```
4. Project Settings → API → URL, `anon` key, `service_role` key.

### Push notifications (VAPID keys, free)

```bash
npx web-push generate-vapid-keys   # prints a public and a private key
```

### Vercel

1. vercel.com → Add New → Project → import `utudesign/remodel-planner`.
2. **Framework Preset: Next.js** (auto-detected). Build/output: defaults. Node 20+.
3. Environment variables (Production + Preview):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` |
| `CLERK_SECRET_KEY` | `sk_live_…` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_…` (if you added the webhook) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/today` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/today` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**server only**, never `NEXT_PUBLIC_`) |
| `ALLOWED_OWNER_EMAILS` | your email (anyone else who signs in sees "No access") |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` (used in booking/share/estimate links) |
| `CRON_SECRET` | any long random string (Vercel sends it to /api/cron) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `GOOGLE_MAPS_API_KEY` *or* `GEOAPIFY_API_KEY` | optional: better address suggestions (see `.env.example`) |

4. Deploy → Settings → Domains → add yours.
5. Crons come from `vercel.json` (19:30 and 20:30 UTC, Mon–Fri; one of them is 3:30 PM in New York).
   On the Hobby plan crons run once a day each, which is all this needs.

## 4. On your iPhone

1. Open `https://<your-domain>` in **Safari** → sign in.
2. Share → **Add to Home Screen** → open the app from the home-screen icon.
3. More → **Push on this phone → Turn on**. (iOS only allows web push from the home-screen app.)
4. More → **My share link** → Copy → post it in your Facebook groups.
5. More → Partners: check RenoDesign's plans. **Edit the placeholder rates once the written agreement
   is signed**, and add RenoDesign's DPOR license number (it prints on the client estimate).
6. Settings: day-job hours, booking slots, tax set-aside %, mileage rate (IRS 2026: 72.5¢).

## 5. Smoke test on the phone (≈10 min)

| # | Do | Expect |
| --- | --- | --- |
| 1 | Sign in the first time | Today, tabs Today · Deals · Money · More; empty but working |
| 2 | + → Paste a message → paste a Marketplace message → Read it → Save | Deal `#26-1001`, name/phone/town filled, on Today under **Reply now** |
| 3 | Open it → **Text it** | Messages opens with your questions + booking link; back in the app the card is gone (first reply logged) |
| 4 | Open the booking link in a private tab → pick a slot | "You're booked"; push on your phone (after 3:30 PM, or right away if it's a new lead); deal moves to Visit booked |
| 5 | Open your share link in a private tab → fill the form | New deal on Today with source "Share link" + a push |
| 6 | Deal → Overview → **Open the site visit form** → enter walls 10 and 12 → Save | Ballpark range appears |
| 7 | Take 4 "before" photos, then turn on airplane mode and take 2 more | Pill: "2 photos saved, waiting for signal"; turn signal on → they upload and tick the checklist |
| 8 | Visit done | Hand-off checklist: measurements + appliance list ticked |
| 9 | Estimate tab → New quick estimate → G1 → L3 | Total + margin + **This pays you**; Home Depot card |
| 10 | Show the client → Client view | `26-1001-E1`, section totals only, no tax line, RenoDesign license line |
| 11 | Deals → search `1001` | Finds the deal |
| 12 | Deal → Partner tab → Hand off before the checklist is done | "Add these first:" + the missing items; Add buttons above |
| 13 | Finish the checklist → Hand off to RenoDesign | Stage "Handed off"; packet buttons: Text summary, Photos ZIP (share sheet), Packet PDF |
| 14 | Job progress: Contract signed, sold $38,500, deposit today → Save | Money: $962.50 owed (5% plan, half at deposit) |
| 15 | Money → Record a payment I received → $962.50 Zelle | Owed $0, "part paid"; Year tab shows it; CSV downloads |
| 16 | + → Add expense (receipt photo) and + → Log trip (24 mi) | Year: net = commissions − expenses − 24 × 72.5¢ |
| 17 | More → Partners → Invite Crystal's email; she signs in on her phone | She sees only handed-off deals at /p, can update job progress; you get a push |

## 6. Changing the schema later

New file in `supabase/migrations/` (next number, never edit an applied one) → `pnpm db:reset` →
`pnpm db:types` → `scripts/test-db.sh` → `pnpm supabase db push`.
