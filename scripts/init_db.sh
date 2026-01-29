#!/usr/bin/env bash
set -euo pipefail

DB_NAME=${DB_NAME:-edinet}
DB_USER=${DB_USER:-edinet_user}
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-5432}
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DDL_PATH="$ROOT_DIR/doc_research/edinet_ddl_draft.sql"
SEED_STD_PATH="$ROOT_DIR/doc_research/edinet_standard_code_seed.sql"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL first." >&2
  exit 1
fi

if command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    echo "PostgreSQL not ready on ${DB_HOST}:${DB_PORT}" >&2
    exit 1
  fi
fi

role_exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'")
if [[ "$role_exists" != "1" ]]; then
  psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE ROLE ${DB_USER} LOGIN CREATEDB"
fi

if [[ -n "${DB_PASSWORD:-}" ]]; then
  psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -v ON_ERROR_STOP=1 \
    -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}'"
fi

db_exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'")
if [[ "$db_exists" != "1" ]]; then
  psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"
fi

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$DDL_PATH"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SEED_STD_PATH"

echo "DB init complete: ${DB_NAME} (user=${DB_USER})"
