#!/usr/bin/env bash
# SessionStart hook: tells the agent (and through it the human) how far this
# checkout is behind origin/main, before any work starts on a stale base.
# Stays quiet when up to date or offline.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git fetch --quiet origin main 2>/dev/null || exit 0

branch="$(git rev-parse --abbrev-ref HEAD)"
behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
[ "$behind" -gt 0 ] || exit 0

if [ "$branch" = "main" ]; then
  echo "This checkout's main is $behind commits behind origin/main. Tell the user and run git pull before starting work."
else
  echo "Branch $branch is $behind commits behind origin/main. Tell the user and suggest git merge origin/main before building on it."
fi
