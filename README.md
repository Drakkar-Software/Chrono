<div align="center">

# ⏱️ Chrono

### From a logged hour to a settled invoice — the freelance time-&-money workspace.

**Track time. Recognize revenue. Pay freelancers. Automatically.**

Universal app for **iOS · Android · Web** from a single codebase.

`Expo SDK 57` · `React Native 0.86` · `React 19` · `TypeScript` · `Supabase` · `offline-first`

</div>

---

## Why Chrono?

Agencies and studios run **many freelancers across many projects** — and the money math is
brutal: different day rates, monthly approvals, invoices, client contracts, referral splits,
and the awkward month where the project hasn't been funded yet. Chrono handles the whole loop
so nobody chases a spreadsheet:

> **Revenue sources** fund each project → **referrers** take their cut off the top →
> freelancers **log & invoice** their time → invoices **settle** against whatever funding is
> available, and any shortfall is **carried forward** to the next month. Every euro is traced.

It works **offline** (log time on the train, it syncs when you're back), it's **multi-tenant**
(one account, many companies), and every screen is **responsive** from phone to desktop.

---

## ✨ Features

| | |
|---|---|
| ⏱️ **Log time your way** | Manual hour entries per project — converted to days & money at each freelancer's rate. |
| ✅ **Approvals built in** | Managers approve billable time before anything is invoiced. |
| 🧾 **Invoices & carry-forward** | Approved time → monthly invoices, settled **FIFO**; shortfalls credited to next month. |
| 📈 **Revenue sources** | Fund projects via **time & materials**, **recurring retainers**, or **self-billing** — recognized monthly. |
| 🤝 **Referral earnings** | Bring a client, earn a % of project revenue **every month** — a first claim, paid off the top. |
| 🏢 **Multi-company** | Belong to many companies; switch between them; invite teammates with secure, expiring invite links. |
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

*Worked example (verified end-to-end):* a project with a €3,000 retainer + a €700/day T&M
contract, one referrer at 10%. A freelancer logs 1 day (7h). Revenue recognized = **€3,700**;
referral paid = **€370**; the freelancer's €450 invoice settles from the remaining **€3,330** →
`paid`. If funding were short, the unpaid balance would carry to next month automatically.

---

## 👤 Roles

- **Freelancer** — logs time on assigned projects, generates & submits invoices, collects referral earnings.
- **Manager** — creates projects, assigns freelancers & rates, defines revenue sources & referrers, approves time, settles months.
- **Admin** — everything a manager can do, plus manages company members and the admin tier itself.

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

**Separation of concerns is strict:** logic lives in `@chrono/sdk` and app `src/lib`; UI lives in
`@chrono/ui` and `src/components`; route pages stay thin (params → hooks → compose). All design
tokens live in one file — no component hardcodes a color or size. The app consumes `@chrono/sdk`
and `@chrono/ui` from **source** via Metro aliases, so there's no build step in dev.

### Tech stack

- **Expo SDK 57** / React Native 0.86 / React 19 / TypeScript 5.9 · expo-router (typed routes)
- **[@expo/ui](https://github.com/expo/expo)** — native SwiftUI / Jetpack Compose components
- **Supabase** (Postgres 15) — auth, database, storage, RLS
- **[@drakkar.software/anchor](https://www.npmjs.com/package/@drakkar.software/anchor)** — offline-first Supabase stores (`useLinkedQuery` / `useMutation` / `useAuth`)

---

## 🗃️ Data model

| Table | Purpose |
|---|---|
| `companies`, `company_members` | Multi-tenancy & roles (`freelancer` / `manager` / `admin`). |
| `company_invites` | Single-use, expiring invite tokens — the only way to join a company. |
| `profiles` | Per-user public profile (name, avatar) + onboarding state. |
| `profile_billing` | Private legal identity (address, VAT, business id) — readable only by self + managers. |
| `projects`, `project_members` | Project config (budget, default TJM, hours/day) + per-freelancer day rate. |
| `time_entries` | Manual entries (`entry_date`, `duration_minutes`, billable, approval status). |
| `revenue_sources` → `revenue_entries` | Typed funding definitions → the recognized-revenue ledger. |
| `project_referrals` → `referral_earnings` | Split-% referrers (≤100% enforced) → the auto-paid first-claim ledger. |
| `invoices` | One per freelancer × project × month; FIFO `submission_seq`, brought/carried credit. |

Two atomic, manager-guarded RPCs do the heavy lifting: **`recognize_project_revenue`** and
**`settle_project_month`** (recognize → pay referrals off the top → settle invoices FIFO →
carry the shortfall forward).

---

## 🔒 Security

Security was reviewed adversarially — every control below was exercised with exploit-attempt
tests against a live Postgres, and the two findings that surfaced were fixed:

- **RLS on every table**, all access scoped through `company_members` (`is_company_member/manager/admin`, `is_project_member`) — verified no cross-tenant read or write.
- **Joining a company requires an invite.** Membership is created only by redeeming a single-use, expiring, 244-bit invite token through a `SECURITY DEFINER` RPC — there is no self-join path, so knowing a company's id grants nothing.
- **Private legal details are compartmentalized.** A freelancer's billing address, VAT and business id live in `profile_billing`, readable only by the freelancer and their managers — peers see names and avatars, never PII.
- **Money is never client-trusted.** A DB trigger recomputes invoice amounts server-side from approved time entries; freelancers cannot set their own `earned_cents` or self-settle.
- **Tenant integrity** — every child row's `company_id` must match its project's company.
- **Admin tier protected** — only admins can grant/alter the `admin` role (with a creator bootstrap).
- **No secrets in the repo**; only the public anon key is used client-side (session stored in SecureStore).

---

## 🚀 Quick start

```bash
pnpm install
pnpm --filter @chrono/sdk build            # build the headless SDK

# Backend (needs the Supabase CLI + Docker)
cd backend/supabase && supabase start && supabase db reset   # migration + seed
supabase gen types typescript --local > ../../packages/sdk/src/schema.ts

# App — put the values from `supabase status` into apps/mobile/.env:
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
pnpm web        # or: pnpm ios · pnpm android
```

**Local demo login** (seeded): `demo@chrono.dev` / `password123`.

### Scripts

| Command | Does |
|---|---|
| `pnpm web` · `pnpm ios` · `pnpm android` | Run the app |
| `pnpm typecheck` | Typecheck every workspace |
| `pnpm test` | Run the SDK money/settlement unit tests |
| `pnpm build` | Turbo build all packages |
| `pnpm db:reset` | Reset the local DB (migration + seed) |
| `pnpm db:types` | Regenerate `schema.ts` from the local DB |

---

## ✅ Verification

The correctness-critical paths are proven, not assumed:

- **50 unit tests** cover the earned / revenue / referral / settlement / VAT / budget / invite math (`pnpm test`).
- **Full typecheck** passes across all packages against the real installed dependencies.
- The **web app bundles** end to end (`expo export -p web`).
- The **migration, seed, revenue recognition, referral first-claim, FIFO settlement,
  carry-forward, the ≤100% referral guard, and cross-tenant RLS isolation** were all verified
  against a live Postgres — including exploit-attempt tests for each security control.
- An **adversarial RLS audit** (a two-tenant fixture, every role played against every table)
  drove out and fixed an uninvited company self-join and a peer-visible PII leak; the fixes
  were re-verified live (self-join blocked, invites still redeemable, peer PII returns nothing).

---

## 📐 Conventions

- **One theme source** — all colors/sizes/fonts in `packages/ui/src/theme.ts`; read via `useTheme()`, never hardcoded.
- **Logic in `@chrono/sdk` + `src/lib`**, **UI in `@chrono/ui` + `src/components`**, **thin route pages**.
- **Money is integer cents** end to end; hours→days→cents flows through one shared helper that matches the DB.

---

<div align="center">
<sub>Built with Expo, Supabase & <code>@drakkar.software/anchor</code> · © 2026 Drakkar Software</sub>
</div>
