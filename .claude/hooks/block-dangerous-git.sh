#!/usr/bin/env bash
# PreToolUse hook: refuse git commands that destroy work. Adapted from
# mattpocock/skills git-guardrails, minus jq (not every laptop has it) and
# minus plain `git push` (.githooks/pre-push refuses pushes to main and from a
# branch behind it).
#
# Matches the raw hook JSON rather than parsing it; a false positive just
# means the human runs the command themselves.

input=$(cat)

patterns=(
  'git[^"]* push[^"]*(--force|-f( |"|$)|--force-with-lease|\+[A-Za-z0-9_./-]+)'
  'git[^"]* reset[^"]* --hard'
  'git[^"]* clean[^"]* -[a-zA-Z]*f'
  'git[^"]* branch[^"]* -D'
  'git[^"]* checkout[^"]* (-- )?\.( |"|$)'
  'git[^"]* restore[^"]* \.( |"|$)'
)

for p in "${patterns[@]}"; do
  if grep -qE "$p" <<<"$input"; then
    echo "BLOCKED by .claude/hooks/block-dangerous-git.sh: this git command can destroy work. Ask the human to run it themselves if it's really needed." >&2
    exit 2
  fi
done
exit 0
