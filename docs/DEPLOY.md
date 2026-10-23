# Deploy & run

Times below are US Eastern. Nothing here needs Stripe: there are no online payments in Phase 1.
Add Stripe webhook steps only when online payments are added.

## 0. What talks to what

```
Phone / browser ──► Vercel (Next.js 16) ──► Supabase Postgres (RLS on every table)
        │                 │   ▲
        │                 │   └── every query carries the Clerk session token;
        │                 │       Supabase verifies it (third-party auth) and RLS reads org_id + sub
        └──► Clerk (sign-in, organizations = the company)
                          └── webhook ──► /api/webhooks/clerk ──► bootstrap_membership() (service role)
```

## 1. Local (your Mac)

Needs Node 20.9+, pnpm 10, and Docker Desktop or OrbStack (for local Supabase).

```bash
cd ~/Claude/remodel-planner
pnpm install
cp .env.example .env.local
```

**Clerk (dev instance)**: dashboard.clerk.com → create app.

1. Configure → **Organizations** → enable. Turn off personal accounts (Membership required).
2. Configure → **Integrations → Supabase** → _Activate_. This adds `"role": "authenticated"` to the session
   token, which Supabase needs. Copy the **Clerk domain** it shows (e.g. `happy-cat-12.clerk.accounts.dev`).
3. API keys → copy the publishable + secret key into `.env.local`.

**Supabase (local)**:

```bash
echo "CLERK_FRONTEND_API_DOMAIN=happy-cat-12.clerk.accounts.dev" > supabase/.env   # your Clerk domain
pnpm db:start        # prints API URL, anon key, service_role key → put them in .env.local
pnpm db:reset        # runs migrations + seed (demo company "Demo Kitchens")
pnpm db:types        # regenerates types/db.ts (only after schema changes)
```

**Run:**

```bash
pnpm dev             # http://localhost:3000
```

Sign up → create your organization (your company) → you land on Today as **admin**.
The first real person in an org becomes admin + default lead owner.

**Use the demo data instead of an empty company** (optional): after creating your org, copy its id
(Clerk → Organizations → `org_...`) and run in Supabase Studio (http://127.0.0.1:54323 → SQL):

```sql
delete from public.companies where clerk_org_id = 'org_XXXX';             -- the empty one the app made
update public.companies set clerk_org_id = 'org_XXXX'
 where id = '00000000-0000-0000-0000-0000000000c1';
```

Sign out and back in. You'll see 3 leads, 2 projects, an overdue payment, a blocked task.

**Webhook locally** is optional: first sign-in creates your user row directly. To test the webhook, tunnel
(`ngrok http 3000`) and use the tunnel URL in step 3 below.

**Checks:**

```bash
pnpm check                                    # lint + typecheck + unit tests + build
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/rules_test.sql   # after `pnpm db:reset`; prints ALL RULE TESTS PASSED
```

## 2. Production

### Supabase

1. supabase.com → New project (region `us-east-1`). Save the DB password.
2. **Authentication → Sign In / Providers → Third-party auth → Add provider → Clerk** → paste your
   **production** Clerk domain (e.g. `clerk.yourdomain.com`).
3. Push the schema (no demo seed is pushed):
   ```bash
   pnpm supabase login
   pnpm supabase link --project-ref <ref>
   pnpm supabase db push
   ```
4. Project Settings → API → copy URL, `anon` key, `service_role` key.

### Clerk (production instance)

1. Clerk → switch to **Production**, add your domain, follow its DNS steps.
2. Organizations on, personal accounts off. Integrations → **Supabase → Activate** (production too).
3. **Webhooks → Add endpoint**: `https://<your-domain>/api/webhooks/clerk`
   Events: `organization.created`, `organization.updated`, `organizationMembership.created`,
   `organizationMembership.deleted`, `user.updated`, `user.deleted`. Copy the **Signing secret** (`whsec_…`).

### Vercel

1. Push to GitHub: `git push -u origin main` (repo `utudesign/remodel-planner`).
2. vercel.com → Add New → Project → import the repo.
3. **Framework Preset: Next.js** (auto-detected). Build command / output: leave default. Node 20+.
4. Environment variables (Production + Preview):

| Variable                                          | Value                                                    |
| ------------------------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Clerk prod `pk_live_…`                                   |
| `CLERK_SECRET_KEY`                                | Clerk prod `sk_live_…`                                   |
| `CLERK_WEBHOOK_SIGNING_SECRET`                    | `whsec_…` from the webhook                               |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | `/sign-in`                                               |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | `/sign-up`                                               |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/today`                                                 |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/today`                                                 |
| `NEXT_PUBLIC_SUPABASE_URL`                        | `https://<ref>.supabase.co`                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                   | anon key                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`                       | service_role key (**server only**, never `NEXT_PUBLIC_`) |

5. Deploy. Add the custom domain in Vercel → Domains.

### Invite the team

Sign in as yourself → create the org → Settings → Team. Invite Crystal and your assistant from the company
menu (sidebar bottom → Manage → Members → Invite). After they join, set roles in **Settings → Team**:
you = Admin, Crystal = Admin, assistant = Office. Tick "Gets new leads" for whoever answers new inquiries.
Each person: open the site on their phone → Share → **Add to Home Screen**.

## 3. Smoke test (≈10 min, on a phone)

| #   | Do                                                                 | Expect                                                                       |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1   | Sign in                                                            | Lands on **Today**; bottom tabs Today/Leads/Projects/Payments/Analytics      |
| 2   | Leads → New lead (name + phone)                                    | Opens the lead; follow-up badge ≈ 1 hour from now; owner = default owner     |
| 3   | Log → Call, "They reached out", save                               | Timeline shows it; Today → Team updates shows it                             |
| 4   | Clear "Next follow-up" and save                                    | Blocked: a follow-up is required                                             |
| 5   | Drag card to **Lost**                                              | Reason dialog; can't save without a reason                                   |
| 6   | Reopen → Deposit received ($36,000, Cabinets + counters + install) | Preview 18,000 / 9,000 / 9,000; lands on the project; lead shows Won         |
| 7   | Projects → drag card to **Install Complete**                       | Earlier milestones dated today; "Cabinets installed" installment becomes Due |
| 8   | Payments → Record that installment                                 | Moves to Received; Today no longer lists it                                  |
| 9   | Project → Tasks → add a **punch item**; Overview                   | Close checklist shows punch list ✗                                           |
| 10  | Costs → add lines with actuals; finish punch; record final payment | Close button enables (admin) → margin locks                                  |
| 11  | As Office user, edit a cost on the closed project                  | Refused: "Only an owner can edit it"                                         |
| 12  | Settings → Pipeline → change "Contacted" rules                     | Next logged touch suggests the new date                                      |

## 4. Changing the schema later

New file in `supabase/migrations/` (never edit an applied one) → `pnpm db:reset` locally →
`pnpm db:types` → `supabase db push` for production.
