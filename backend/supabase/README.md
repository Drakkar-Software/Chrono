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
```
