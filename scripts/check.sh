#!/usr/bin/env bash
# Runs every Command from AGENTS.md (typecheck, lint, format, tests for the Node
# and the dashboard) and prints what passed, failed or could not run:
#   scripts/check.sh            everything
#   scripts/check.sh node       only the Node service
#   scripts/check.sh dashboard  only the dashboard
# Works around the gaps in docs/agents/lessons.md: no uv (uses a venv from this
# or the main checkout), no pnpm (runs dashboard/node_modules/.bin directly),
# Node older than 22 (runs Vitest under npx node@22), and a worktree with no
# node_modules (uses the main checkout's). A step that could not run counts as
# a failure: never call a ticket done on a skipped check.
set -uo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
main_checkout="$(cd "$repo" && cd "$(git rev-parse --git-common-dir)/.." && pwd)"
only="${1:-all}"

results=""
failed=0
record() {
  results+="$(printf '  %-6s %s' "$1" "$2")"$'\n'
  [ "$1" = "pass" ] || failed=1
}
run_step() {
  local name="$1"
  shift
  echo "==> $name"
  if "$@"; then record pass "$name"; else record FAIL "$name"; fi
}

check_node() {
  cd "$repo/node" || return
  local python_tools=()
  if command -v uv >/dev/null 2>&1; then
    uv sync --quiet || { record FAIL "node: uv sync"; return; }
    python_tools=(uv run)
  else
    local venv=""
    for candidate in "$repo/node/.venv" "$main_checkout/node/.venv"; do
      [ -x "$candidate/bin/pytest" ] && { venv="$candidate"; break; }
    done
    if [ -z "$venv" ]; then
      record SKIP "node: no uv and no node/.venv with pytest (install uv: see lessons.md)"
      return
    fi
    echo "(no uv: using $venv with PYTHONPATH=src so it tests this checkout)"
    export PYTHONPATH=src
    python_tools=(env "PATH=$venv/bin:$PATH")
  fi
  run_step "node: mypy" "${python_tools[@]}" mypy src tests
  run_step "node: ruff check" "${python_tools[@]}" ruff check .
  run_step "node: ruff format" "${python_tools[@]}" ruff format --check .
  run_step "node: pytest" "${python_tools[@]}" pytest -q
}

check_dashboard() {
  cd "$repo/dashboard" || return
  local modules="$repo/dashboard/node_modules"
  if [ ! -d "$modules" ]; then
    if command -v pnpm >/dev/null 2>&1; then
      pnpm install --frozen-lockfile --silent || { record FAIL "dashboard: pnpm install"; return; }
    elif [ -d "$main_checkout/dashboard/node_modules" ]; then
      # Config files import their plugins from ./node_modules, so link it in;
      # git sees the link as an untracked file, hence removing it on exit.
      echo "(no node_modules here: linking the main checkout's for this run)"
      ln -s "$main_checkout/dashboard/node_modules" "$modules"
      trap 'rm -f "$repo/dashboard/node_modules"' EXIT
    else
      record SKIP "dashboard: no node_modules and no pnpm (try: npx --yes pnpm@10 install)"
      return
    fi
  fi
  local bin="$modules/.bin"
  run_step "dashboard: typecheck" "$bin/tsc" --noEmit
  run_step "dashboard: eslint" "$bin/eslint" .
  run_step "dashboard: prettier" "$bin/prettier" --check .
  # Vitest's jsdom worker dies on Node 20 (lessons.md, ticket 0006).
  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$node_major" -ge 22 ]; then
    run_step "dashboard: vitest" "$bin/vitest" run
  else
    echo "(Node $node_major: running Vitest under node@22)"
    run_step "dashboard: vitest" npx --yes node@22 "$modules/vitest/vitest.mjs" run
  fi
}

case "$only" in
  all) check_node; check_dashboard ;;
  node) check_node ;;
  dashboard) check_dashboard ;;
  *) echo "usage: scripts/check.sh [node|dashboard]" >&2; exit 2 ;;
esac

echo
echo "summary:"
printf '%s' "$results"
if [ "$failed" = 1 ]; then
  echo "not done: fix every FAIL and SKIP above."
  exit 1
fi
echo "all Commands pass."
