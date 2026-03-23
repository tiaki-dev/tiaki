#!/usr/bin/env bash
# Verify that all expected columns exist in the database.
# Run: DATABASE_URL=postgres://... bash scripts/verify-migrations.sh
set -euo pipefail

DB="${DATABASE_URL:-postgres://tiaki:tiaki@localhost:5432/tiaki}"

check_column() {
  local table=$1 column=$2
  result=$(psql "$DB" -tAc "SELECT 1 FROM information_schema.columns WHERE table_name='$table' AND column_name='$column'")
  if [ "$result" = "1" ]; then
    echo "  ✓ $table.$column"
  else
    echo "  ✗ $table.$column  <-- MISSING"
    FAILED=1
  fi
}

check_enum_value() {
  local enum=$1 value=$2
  result=$(psql "$DB" -tAc "SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='$enum' AND e.enumlabel='$value'")
  if [ "$result" = "1" ]; then
    echo "  ✓ enum $enum has '$value'"
  else
    echo "  ✗ enum $enum missing '$value'  <-- MISSING"
    FAILED=1
  fi
}

FAILED=0

echo "=== policies ==="
check_column policies max_bump

echo "=== update_results ==="
check_column update_results vulnerabilities
check_column update_results release_summary

echo "=== enums ==="
check_enum_value update_status deploying
check_enum_value notification_type ntfy

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "FAIL: one or more columns/enum values are missing — run the missing migrations manually."
  exit 1
else
  echo ""
  echo "OK: all schema checks passed."
fi
