# Chrono

**Multi-tenant freelance time-tracking, revenue recognition & invoicing** — a universal
(iOS · Android · web) [Expo](https://expo.dev) app with a [Supabase](https://supabase.com)
backend. Companies track the time their freelancers log against projects, recognize project
revenue from multiple sources, and pay freelancers by invoice with funding-limited,
carry-forward settlement.

Built on the same Expo/monorepo shell as **OctoChat** and the same offline Supabase data
layer as **Aesthemedstaff** (`@drakkar.software/anchor`).

## Money flow (per project, per month)

```
revenue sources ──► recognized revenue ──► referrers take % off the top (first claim)
(time-based /          (monthly ledger)         │
 recurring /                                     ▼
 self-billing)                          remaining = funding pool
                                                 │
        freelancers log hours → approved ────────┼──► monthly invoices (hours→days×TJM)
                                                 ▼
                                    settled FIFO against the pool
                                                 │
                                    shortfall → credited to next month
```

Margin = recognized revenue − referral − freelancer cost.

## Monorepo layout

```
chrono/
├── apps/mobile/          # @chrono/mobile — the Expo app (expo-router, iOS/Android/web)
├── packages/
│   ├── sdk/              # @chrono/sdk — headless domain logic (types, queries, money math). No React/UI.
│   ├── ui/              # @chrono/ui — component kit on @expo/ui (native) + react-native-web fallbacks
│   └── tsconfig/        # @chrono/tsconfig — shared TS base
└── backend/supabase/     # config.toml, migrations, seed.sql (the whole data model + RLS + RPCs)
```

pnpm workspaces + Turbo, `nodeLinker: hoisted` (required for Metro). The app consumes
`@chrono/sdk` and `@chrono/ui` from **source** via Metro aliases (no build step in dev).

## Tech stack

- **Expo SDK 57** / React Native 0.86 / React 19.2 / TypeScript 5.9, expo-router (typed routes).
- **@expo/ui** (SwiftUI / Jetpack Compose) native primitives with react-native-web fallbacks,
  wrapped in `@chrono/ui` behind a single design-token theme (light + dark).
- **Supabase** (Postgres 15) for auth, database, storage.
- **@drakkar.software/anchor** — offline-first Supabase stores (SQLite on native, localStorage
  on web) with `useLinkedQuery` / `useMutation` / `useAuth`; data persists offline and syncs on
  reconnect.

## Data model (see `backend/supabase/migrations`)

- **companies** + **company_members** (`role: freelancer | manager | admin`) — multi-tenancy & roles.
- **profiles** — per-user, `onboarded` flag.
- **projects** (budget, default TJM, hours_per_day, client) + **project_members** (per-freelancer TJM).
- **time_entries** — manual entries (`entry_date`, `duration_minutes`, billable, approval status).
- **revenue_sources** (`time_based` client day rate / `recurring` fixed monthly / `self_billing`) →
  **revenue_entries** — the recognized-revenue funding ledger.
- **project_referrals** (split %, ≤100 enforced) → **referral_earnings** — auto-paid first-claim ledger.
- **invoices** — one per freelancer × project × month; `submission_seq` FIFO, `credit_brought/carried_forward`.
- **RPCs**: `recognize_project_revenue(project, month)` and `settle_project_month(project, month)`
  (SECURITY DEFINER, manager-guarded, atomic). Settlement recognizes revenue, pays referrals off the
  top, then settles submitted invoices FIFO against the remaining pool, carrying any shortfall forward.

Row-Level Security is enabled on every table; all access is scoped through `company_members` via
`is_company_member / is_company_manager / is_company_admin` (and `is_project_member`) SECURITY
DEFINER helpers.

## Getting started

```bash
pnpm install
pnpm --filter @chrono/sdk build          # build the headless SDK (dist)

# Backend (requires the Supabase CLI + Docker)
cd backend/supabase && supabase start && supabase db reset   # applies migration + seed
supabase gen types typescript --local > ../../packages/sdk/src/schema.ts   # regenerate types

# App — set apps/mobile/.env from `supabase status`:
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
pnpm web        # or: pnpm ios / pnpm android
```

Local demo login (from `seed.sql`): **demo@chrono.dev** / **password123**.

## Scripts

| Command | Description |
|---|---|
| `pnpm web` / `pnpm ios` / `pnpm android` | Run the app |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm test` | Run tests (SDK money/settlement unit tests) |
| `pnpm build` | Turbo build all packages |
| `pnpm db:reset` | Reset the local Supabase DB (migration + seed) |
| `pnpm db:types` | Regenerate `packages/sdk/src/schema.ts` from the local DB |

## Conventions

- **One theme source** — all colors/sizes/fonts live in `packages/ui/src/theme.ts`; components read
  tokens via `useTheme()`, never hardcode.
- **Logic in `@chrono/sdk`** (headless) and app `src/lib` (React hooks/contexts); **UI in `@chrono/ui`**
  and `src/components`; **route pages stay thin** (params + hooks + compose).
- Money is integer **cents** end to end; hours→days→cents via one shared `computeEarnedCents` helper
  that matches the DB RPC.

## Verification

- `pnpm test` — SDK unit tests for the earned/revenue/referral/settlement math.
- `pnpm typecheck` — all packages typecheck against installed deps.
- The migration, seed, revenue recognition, referral first-claim, FIFO settlement, carry-forward,
  the referral ≤100% guard, and cross-tenant RLS isolation are verified against a live Postgres.
