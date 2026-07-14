<div align="center">

<img src="logo.png" alt="Chrono" width="200" />

# Chrono

### From a logged hour to a settled invoice — the freelance time-&-money workspace.

*Track time · recognize revenue · pay freelancers — automatically.*

<br/>

[![Live](https://img.shields.io/badge/live-chrono.drakkar.software-6C5CE7?style=for-the-badge)](https://chrono.drakkar.software)

![Platforms](https://img.shields.io/badge/iOS_·_Android_·_Web-one_codebase-6C5CE7)
![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_15-3ECF8E?logo=supabase&logoColor=white)
![Tests](https://img.shields.io/badge/tests-50_passing-brightgreen)
![Offline-first](https://img.shields.io/badge/offline-first-0984E3)

</div>

---

## Why Chrono?

Agencies and studios run **many freelancers across many projects**, and the money math is brutal:
different day rates, monthly approvals, client contracts, referral splits, and the awkward month
where a project isn't funded yet. Chrono runs the whole loop so nobody chases a spreadsheet.

> **Revenue sources** fund each project → **referrers** take their cut off the top → freelancers
> **log & invoice** their time → invoices **settle** against available funding, and any shortfall
> **carries forward** to the next month. Every euro is traced.

Works **offline** (log time on the train, it syncs when you're back), is **multi-tenant** (one
account, many companies), and is **responsive** from phone to desktop.

---

## ✨ Features

| | |
|---|---|
| ⏱️ **Log time your way** | Manual hour entries per project — converted to days & money at each freelancer's rate. |
| ✅ **Approvals built in** | Managers approve billable time before anything is invoiced. |
| 🧾 **Invoices & carry-forward** | Approved time → monthly invoices, settled **FIFO**; shortfalls credited to next month. |
| 📈 **Revenue sources** | Fund projects via **time & materials**, **recurring retainers**, or **self-billing** — recognized monthly. |
| 🤝 **Referral earnings** | Bring a client, earn a % of project revenue **every month** — a first claim, paid off the top. |
| 🏢 **Multi-company** | Belong to many companies, switch between them, invite teammates with secure expiring links. |
| 🔐 **Secure by construction** | Row-Level Security on every table; server-computed money; no client-trusted amounts. |
| 📴 **Offline-first** | Backed by `@drakkar.software/anchor` — SQLite on native, localStorage on web, syncs on reconnect. |
| 🎨 **Native feel, everywhere** | Native SwiftUI / Jetpack Compose controls via `@expo/ui`, with web fallbacks. |

---

## 💸 How the money flows

```
 revenue sources ──▶ recognized revenue ──▶ referrers take % off the top (first claim)
 (time & materials      (monthly ledger)              │
  · recurring                                         ▼
  · self-billing)                          remaining = the funding pool
                                                      │
 freelancers log hours ─▶ manager approves ──────────┼──▶ monthly invoices (hours→days×TJM)
                                                      ▼
                                        settled FIFO against the pool
                                                      │
                                    shortfall ─▶ credited to next month
```

**Margin = recognized revenue − referral − freelancer cost** — surfaced per project in Reports.

> **Worked example** *(verified end-to-end)* — a project with a €3,000 retainer + a €700/day T&M
> contract and one referrer at 10%. A freelancer logs 1 day (7h): revenue recognized **€3,700**,
> referral paid **€370**, and the freelancer's **€450** invoice settles from the remaining
> **€3,330** → `paid`. Were funding short, the unpaid balance would carry forward automatically.

---

## 👤 Roles

| Role | Can |
|---|---|
| **Freelancer** | Log time on assigned projects, generate & submit invoices, collect referral earnings. |
| **Manager** | Create projects, assign freelancers & rates, define revenue sources & referrers, approve time, settle months. |
| **Admin** | Everything a manager can, plus manage company members and the admin tier itself. |

---

## 🏗️ Architecture

A **pnpm + Turbo monorepo** (`nodeLinker: hoisted` for Metro):

```
chrono/
├── apps/mobile/          @chrono/mobile — the Expo app (expo-router · iOS/Android/web)
├── packages/
│   ├── sdk/              @chrono/sdk — headless domain logic: types, Supabase queries,
│   │                     the money/settlement math. Zero React, zero UI.
│   ├── ui/               @chrono/ui — the component kit: @expo/ui native primitives +
│   │                     react-native-web fallbacks, over one design-token theme (light/dark).
│   └── tsconfig/         @chrono/tsconfig — shared TS base.
└── backend/supabase/     config.toml · migrations · seed.sql — the entire data model,
                          Row-Level Security, and the settlement/recognition functions.
```

**Separation of concerns is strict** — logic in `@chrono/sdk` + app `src/lib`, UI in `@chrono/ui`
+ `src/components`, route pages stay thin (params → hooks → compose). Every design token lives in
one file; no component hardcodes a color or size. The app consumes `@chrono/sdk` and `@chrono/ui`
from **source** via Metro aliases — no build step in dev.

**Stack** — Expo SDK 57 · React Native 0.86 · React 19 · TypeScript 5.9 · expo-router (typed
routes) · [`@expo/ui`](https://github.com/expo/expo) native primitives · Supabase (Postgres 15) ·
[`@drakkar.software/anchor`](https://www.npmjs.com/package/@drakkar.software/anchor) offline-first
stores (`useLinkedQuery` / `useMutation` / `useAuth`).

---

## 🗃️ Data model

| Table | Purpose |
|---|---|
| `companies` · `company_members` | Multi-tenancy & roles (`freelancer` / `manager` / `admin`). |
| `company_invites` | Single-use, expiring invite tokens — the only way to join a company. |
| `profiles` | Per-user public profile (name, avatar) + onboarding state. |
| `profile_billing` | Private legal identity (address, VAT, business id) — self + managers only. |
| `projects` · `project_members` | Project config (budget, default TJM, hours/day) + per-freelancer day rate. |
| `time_entries` | Manual entries (`entry_date`, `duration_minutes`, billable, approval status). |
| `revenue_sources` → `revenue_entries` | Typed funding definitions → the recognized-revenue ledger. |
| `project_referrals` → `referral_earnings` | Split-% referrers (≤100% enforced) → the auto-paid first-claim ledger. |
| `invoices` | One per freelancer × project × month; FIFO `submission_seq`, brought/carried credit. |

Two atomic, manager-guarded RPCs do the heavy lifting — **`recognize_project_revenue`** and
**`settle_project_month`** (recognize → pay referrals off the top → settle invoices FIFO → carry
the shortfall forward).

---

## 🔒 Security

Reviewed adversarially — every control below was exercised with exploit-attempt tests against a
live Postgres, and the two findings that surfaced were fixed:

- **RLS on every table**, all access scoped through `company_members` (`is_company_member/manager/admin`, `is_project_member`) — no cross-tenant read or write.
- **Joining requires an invite** — membership is created only by redeeming a single-use, expiring, 244-bit token through a `SECURITY DEFINER` RPC. No self-join path, so knowing a company id grants nothing.
- **Private legal details are compartmentalized** — billing address, VAT and business id live in `profile_billing`, readable only by the owner and their managers; peers see names and avatars, never PII.
- **Money is never client-trusted** — a DB trigger recomputes invoice amounts server-side from approved time entries; freelancers can't set their own `earned_cents` or self-settle.
- **Tenant integrity** — every child row's `company_id` must match its project's company.
- **Admin tier protected** — only admins grant or alter the `admin` role (with a creator bootstrap).
- **No secrets in the repo** — only the public anon key is used client-side (session in SecureStore).

---

## 🚀 Quick start

```bash
pnpm install
pnpm --filter @chrono/sdk build            # build the headless SDK

# Backend (needs the Supabase CLI + Docker)
supabase --workdir backend start && supabase --workdir backend db reset   # migration + seed
supabase --workdir backend gen types typescript --local > packages/sdk/src/schema.ts

# App — copy the template and fill in the values from `supabase status`
cp apps/mobile/.env.template apps/mobile/.env
pnpm web        # or: pnpm ios · pnpm android
```

**Local demo login** (seeded): `demo@chrono.dev` / `password123`.

| Command | Does |
|---|---|
| `pnpm web` · `pnpm ios` · `pnpm android` | Run the app |
| `pnpm typecheck` | Typecheck every workspace |
| `pnpm test` | Run the SDK money/settlement unit tests |
| `pnpm build` | Turbo build all packages |
| `pnpm db:reset` | Reset the local DB (migration + seed) |
| `pnpm db:types` | Regenerate `schema.ts` from the local DB |

---

## 🌍 Environment & deployment

The app reads a few `EXPO_PUBLIC_*` variables. **They're inlined into the JS bundle at _build_
time** (`expo export`), not read at runtime — so they must be present wherever the build runs
(your shell locally, the host's build settings for a deploy). There's no committed `.env`;
`apps/mobile/.env` is gitignored and only `.env.template` ships.

| Variable | Required | Purpose |
|---|:---:|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL — `https://<ref>.supabase.co` (or `http://127.0.0.1:54321` locally). |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase **anon / public** key (safe client-side; never the service-role key). |
| `EXPO_PUBLIC_APP_URL` | — | Public site URL (e.g. `https://chrono.drakkar.software`) for auth email redirect links. |

> ⚠️ **Blank screen after deploy?** If the two required vars are missing at build time they
> compile to `undefined` and the Supabase client throws `supabaseUrl is required` at startup —
> the app white-screens before it renders. Set the variables and rebuild.

**Deploy (Cloudflare Workers).** `pnpm build:web` writes `apps/mobile/dist`, and the root
`wrangler.jsonc` serves it as a static-assets Worker with single-page-application routing. Then:

1. In the Cloudflare project → **Settings → Variables and Secrets**, add the `EXPO_PUBLIC_*`
   variables above as **build-time** variables (runtime-only secrets won't work — they're baked
   in during `build:web`).
2. Point `EXPO_PUBLIC_SUPABASE_URL` at a **hosted** Supabase project, not `127.0.0.1`.
3. Trigger a build — `pnpm install && pnpm build:web`, then `npx wrangler deploy`.

---

## ✅ Verification

The correctness-critical paths are proven, not assumed:

- **50 unit tests** cover the earned / revenue / referral / settlement / VAT / budget / invite math (`pnpm test`).
- **Full typecheck** passes across all packages against the real installed dependencies.
- The **web app bundles** end to end (`expo export -p web`).
- **Migration, seed, revenue recognition, referral first-claim, FIFO settlement, carry-forward, the ≤100% referral guard, and cross-tenant RLS isolation** were all verified against a live Postgres — with exploit-attempt tests for each security control.
- An **adversarial RLS audit** (a two-tenant fixture, every role played against every table) drove out and fixed an uninvited company self-join and a peer-visible PII leak, then re-verified the fixes live.

---

## 📐 Conventions

- **One theme source** — all colors/sizes/fonts in `packages/ui/src/theme.ts`, read via `useTheme()`, never hardcoded.
- **Logic in `@chrono/sdk` + `src/lib`**, **UI in `@chrono/ui` + `src/components`**, **thin route pages**.
- **Money is integer cents** end to end; hours→days→cents flows through one shared helper that matches the DB.

---

<div align="center">
<sub>Built with Expo, Supabase & <code>@drakkar.software/anchor</code> · © 2026 Drakkar Software</sub>
</div>
