#!/bin/sh
set -u

FAILED=0
OUTPUT=""

has_script() {
  node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)" 2>/dev/null
}

if [ -f pnpm-lock.yaml ]; then
  PM=pnpm
elif [ -f package-lock.json ]; then
  PM=npm
else
  PM=pnpm
fi

if ! command -v "$PM" >/dev/null 2>&1; then
  echo "Skipping checks: $PM is not installed." >&2
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "Skipping checks: node_modules is not installed in this worktree. Run $PM install before relying on hook checks." >&2
  exit 0
fi

run_script() {
  "$PM" run "$1"
}

run_exec() {
  if [ "$PM" = "npm" ]; then
    npm exec -- "$@"
  else
    pnpm exec "$@"
  fi
}

run_check() {
  name="$1"
  shift

  if result=$("$@" 2>&1); then
    echo "[ok] $name passed" >&2
  else
    FAILED=1
    OUTPUT="$OUTPUT\n\n[fail] $name FAILED:\n$result"
    echo "[fail] $name failed" >&2
  fi
}

run_check "format" run_script format
run_check "lint" run_exec biome check --error-on-warnings .
if has_script typecheck; then run_check "typecheck" env SKIP_ENV_VALIDATION=true "$PM" run typecheck; fi
if has_script knip; then run_check "knip" "$PM" run knip; fi
if has_script test; then run_check "test" env SKIP_ENV_VALIDATION=true "$PM" run test; fi

if [ "$FAILED" -ne 0 ]; then
  printf "\n=== ERRORS TO FIX ===\n" >&2
  printf "%b\n" "$OUTPUT" >&2
  exit 2
fi

echo "All checks passed." >&2
