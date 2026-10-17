#!/usr/bin/env bash
# SessionStart hook: runs scripts/doctor.sh so a stale branch, a missing tool or
# a forgotten Node is raised before any work starts, without anyone remembering
# to check. Silent when all is well; whatever it prints reaches the agent.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -x scripts/doctor.sh ] || exit 0
problems="$(scripts/doctor.sh --quiet 2>/dev/null)"
[ -n "$problems" ] || exit 0

echo "scripts/doctor.sh found setup problems. Tell the user about each one and its fix before starting work:"
echo "$problems"
