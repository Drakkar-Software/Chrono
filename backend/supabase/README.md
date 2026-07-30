# Chrono — Supabase backend

The entire data model lives in `migrations/` (schema, Row-Level Security, and the
recognition/settlement functions), with demo data in `seed.sql`.

## Deploy

A GitHub Action (`.github/workflows/supabase.yml`) deploys on every push to
`master` that touches `backend/supabase/**`: it links the hosted project and runs
`supabase db push` to apply any migrations the remote is missing.

Required on the `Production - Supabase` environment:

- secret `SUPABASE_ACCESS_TOKEN`
- secret `SUPABASE_DB_PASSWORD`
- var `SUPABASE_PROJECT_ID` (the hosted project ref)

## "Remote database is up to date" but the schema is empty

`db push` only applies migrations whose version is missing from the remote
`supabase_migrations.schema_migrations` history. If that history lists the
migrations as applied while the tables don't actually exist (e.g. the schema was
dropped/reset out of band), `push` will report "up to date" and create nothing.

To recover, run the workflow manually (Actions → **Chrono - Supabase** → Run
workflow) with **`repair_history` = true**: it marks every local migration as
`reverted` on the remote, then `db push` re-applies them all from scratch. This
repair path never runs on a normal push.

## Local

```bash
cd backend/supabase
pnpm start          # supabase start
pnpm reset          # db reset (migrations + seed)
pnpm types          # regenerate ../../packages/sdk/src/schema.ts
pnpm push           # db push to the linked project
pnpm test           # pgTAP database tests (invites + rem compute/security)
```

## Database tests (pgTAP)

`supabase/tests/database/*.test.sql` — run with `pnpm test` (needs the Supabase
CLI + Docker). Coverage:

| File | Feature area |
|---|---|
| `000` | shared harness + helpers |
| `010`–`040` | company invites — accept lifecycle, escalation guards, RLS, seat/edge |
| `050`–`070` | unified remuneration ("rem") — compute golden math, security/capacity, jungle FIFO + staffing fee |
| `080` | revenue recognition — `recognize_project_revenue` (recurring / time_based / manual / self_billing markup, auth, retire-on-zero, in-window) |
| `090` | settlement — `settle_project_month` funding pool: README worked example, paid-revenue gate, FIFO by `submission_seq`, per-freelancer carry-forward, fixed-cost deduction, referral first-claim, auth |
| `100` | invoice integrity + referrals — server recompute, tenant integrity, settled-status transitions, cancel-frees-entries, invoiced-entry freeze, `enforce_referral_total` ≤100% |
| `110` | project costs — kind-discriminated CHECKs, `project_cost_cumulative`, `mark_project_costs_paid` auth + reimbursable guard |
| `120` | workflow/blog/notifications — sequential invoice numbering, time-entry approver stamping + submit/review notifications, correction net-non-negative guard, blog published-only RLS |

### Running the tests without Docker

`tests/_run_local.sh` rebuilds a throwaway DB from `tests/_local_bootstrap.psql`
(a minimal local stand-in for the Supabase platform: roles, `auth`/`storage`
schemas, `auth.uid()`) + every migration, then runs the suite with `pg_prove`.
Needs a running PostgreSQL and `postgresql-<v>-pgtap`. Neither `_`-prefixed file
is a test (they are skipped by the `*.test.sql` runner):

```bash
# against a local PG on port 54399, as the postgres superuser
PGPORT=54399 bash tests/_run_local.sh
```
