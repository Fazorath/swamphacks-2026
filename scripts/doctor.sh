#!/usr/bin/env bash
# Checks this machine and checkout for every setup problem in docs/agents/lessons.md
# and prints the fix for each. Takes seconds; run it when something odd happens
# or at the start of a ticket:  scripts/doctor.sh
# `--quiet` prints only the problems and always exits 0, for the hooks that run it
# for you (Claude Code session start, git post-merge), so nobody has to remember.
set -uo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo" || exit 1
main_checkout="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
problems=0
quiet=false
[ "${1:-}" = "--quiet" ] && quiet=true

section() { $quiet || echo "$1"; }
ok() { $quiet || echo "  ok    $1"; }
fix() { echo "  FIX   $1"; echo "        -> $2"; problems=$((problems + 1)); }

section "tools"
if command -v uv >/dev/null 2>&1; then
  ok "uv $(uv --version | awk '{ print $2 }')"
elif [ -x "$main_checkout/node/.venv/bin/pytest" ]; then
  fix "no uv (scripts/check.sh falls back to $main_checkout/node/.venv)" \
    "install uv: curl -LsSf https://astral.sh/uv/install.sh | sh  (Windows: irm https://astral.sh/uv/install.ps1 | iex)"
else
  fix "no uv and no Node venv to fall back on" \
    "install uv: curl -LsSf https://astral.sh/uv/install.sh | sh  (Windows: irm https://astral.sh/uv/install.ps1 | iex)"
fi

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm $(pnpm --version)"
else
  fix "no pnpm" "use npx --yes pnpm@10 <command> from dashboard/, or: npm install -g pnpm@10"
fi

# A Claude Code cloud session reaches GitHub through its own tools, not gh.
if [ -n "${CLAUDE_CODE_REMOTE:-}" ]; then
  ok "cloud session: GitHub through its own tools"
elif ! command -v gh >/dev/null 2>&1; then
  fix "no GitHub CLI (the implement skill uses it for issues and pull requests)" \
    "install gh (https://cli.github.com), then: gh auth login"
elif ! gh auth status >/dev/null 2>&1; then
  fix "gh is not logged in" "gh auth login"
else
  ok "gh logged in"
fi

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$node_major" -ge 22 ]; then
  ok "Node $node_major"
elif [ "$node_major" = 0 ]; then
  fix "no Node.js" "install Node 22 (https://nodejs.org)"
else
  fix "Node $node_major: Vitest's jsdom worker dies before 22" \
    "install Node 22, or let scripts/check.sh run Vitest under npx node@22"
fi

section "checkout"
# Relative from Claude Code's session hook, or absolute to the main checkout's copy.
hooks_path="$(git config core.hooksPath || true)"
if [ "${hooks_path%/}" = ".githooks" ] || [ "${hooks_path%/}" = "$main_checkout/.githooks" ]; then
  ok "git hooks on (secret scan, attribution strip, pre-push checks)"
else
  fix "git hooks off" "git config core.hooksPath .githooks"
fi

if [ -d dashboard/node_modules ]; then
  ok "dashboard/node_modules"
else
  fix "no dashboard/node_modules" \
    "cd dashboard && pnpm install  (scripts/check.sh links the main checkout's for its own run)"
fi

if git fetch --quiet origin main 2>/dev/null; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  behind="$(git rev-list --count HEAD..origin/main)"
  if [ "$behind" = 0 ]; then
    ok "$branch is up to date with origin/main"
  elif [ "$branch" = main ]; then
    fix "main is $behind commits behind origin/main" "git pull"
  else
    fix "$branch is $behind commits behind origin/main" "git merge origin/main"
  fi
else
  fix "could not fetch origin" "check the network or your GitHub login"
fi

section "running Nodes"
if pgrep -f "storm_shield.main import run|storm-shield-node" >/dev/null 2>&1; then
  fix "a Node is running (it may hold test ports or serve old code)" \
    "scripts/stop-nodes.sh, unless you started it on purpose"
else
  ok "no Node running"
fi

if $quiet; then
  exit 0
fi
echo
if [ "$problems" = 0 ]; then
  echo "all good."
else
  echo "$problems thing(s) to fix above."
  exit 1
fi
