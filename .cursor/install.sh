#!/usr/bin/env bash
# Idempotent repository bootstrap for the Chrono Cloud Agent environment.
# Runs after the source is checked out. Docker, the Supabase CLI and the
# Supabase images are already baked into the base snapshot; this only refreshes
# source-derived state, so it must stay fast and repeatable.
set -euo pipefail

cd "$(dirname "$0")/.."

# JS dependencies (hoisted node_modules for Metro) + the headless SDK build the
# app and tests consume.
pnpm install --frozen-lockfile
pnpm --filter @chrono/sdk build

# The Expo app reads its Supabase connection from apps/mobile/.env (gitignored).
# The local stack always exposes the same URL and well-known anon key, so we can
# write a deterministic file when one is not already present.
if [ ! -f apps/mobile/.env ]; then
  cat > apps/mobile/.env <<'ENV'
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
ENV
fi
