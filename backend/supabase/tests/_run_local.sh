#!/usr/bin/env bash
# Local pgTAP runner: rebuild a throwaway DB from bootstrap + migrations (+seed),
# then run the pgTAP suite with pg_prove. Requires a running PG on $PGPORT.
set -euo pipefail

PGPORT="${PGPORT:-54399}"
PGHOST="${PGHOST:-127.0.0.1}"
DBNAME="${DBNAME:-chrono_test}"
export PGPASSWORD=""
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPA="$(cd "$HERE/.." && pwd)"
PSQL="psql -v ON_ERROR_STOP=1 -h $PGHOST -p $PGPORT -U postgres -q"

SEED="${SEED:-0}"

echo "== drop/create $DBNAME =="
psql -h "$PGHOST" -p "$PGPORT" -U postgres -q -c "drop database if exists $DBNAME;" -c "create database $DBNAME;"
# pgTAP + Chrono's extensions live in the extensions schema (as on Supabase); put it
# on the search_path so unqualified plan()/ok()/gen_random_uuid() resolve.
psql -h "$PGHOST" -p "$PGPORT" -U postgres -q -c "alter database $DBNAME set search_path = public, extensions;"

echo "== bootstrap =="
$PSQL -d "$DBNAME" -f "$HERE/_local_bootstrap.psql" >/dev/null

echo "== migrations =="
for f in $(ls "$SUPA"/migrations/*.sql | sort); do
  $PSQL -d "$DBNAME" -f "$f" >/dev/null
done

if [ "$SEED" = "1" ]; then
  echo "== seed =="
  $PSQL -d "$DBNAME" -f "$SUPA/seed.sql" >/dev/null
fi

echo "== pgTAP tests =="
pg_prove -h "$PGHOST" -p "$PGPORT" -U postgres -d "$DBNAME" --ext .sql "$@" "$HERE"/database/*.test.sql
