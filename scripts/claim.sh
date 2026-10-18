#!/usr/bin/env bash
# Claims a ticket on main in one step, so nobody else can grab it a minute later:
#   scripts/claim.sh 0052
# Checks the ticket on the latest origin/main (unclaimed, blockers done), sets
# Owner to your git user.name and Status to in-progress, pushes that to main,
# and creates the NNNN-<slug> branch from it. Your working tree is not touched:
# the claim is made in a throwaway worktree, so it works from any branch.
set -euo pipefail

number="${1:-}"
case "$number" in
  [0-9][0-9][0-9][0-9]) ;;
  *) echo "usage: scripts/claim.sh NNNN" >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.."
owner="$(git config user.name || true)"
[ -n "$owner" ] || { echo "claim: set git config user.name first" >&2; exit 1; }

field() {
  sed -n "s/^\*\*$1:\*\* *//p" | head -n 1
}

scratch="$(mktemp -d)"
trap 'git worktree remove --force "$scratch/main" >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT

# Someone may push between our fetch and our push; start over from their main.
for attempt in 1 2 3; do
  git fetch --quiet origin main
  ticket="$(git ls-tree --name-only origin/main docs/tickets/ | grep "^docs/tickets/$number-" || true)"
  [ -n "$ticket" ] || { echo "claim: no ticket $number on origin/main" >&2; exit 1; }
  slug="$(basename "$ticket" .md)"

  current_owner="$(git show "origin/main:$ticket" | field Owner)"
  status="$(git show "origin/main:$ticket" | field Status)"
  if [ "$current_owner" != "unclaimed" ] && [ "$current_owner" != "$owner" ]; then
    echo "claim: $slug is owned by $current_owner (status $status). Hands off." >&2
    exit 1
  fi
  case "$status" in
    done*) echo "claim: $slug is already done." >&2; exit 1 ;;
  esac

  # "Blocked by: 0043, 0046" or "None (can start immediately; read by 0033)": a parenthetical is a note, not a blocker.
  for blocker in $(git show "origin/main:$ticket" | field "Blocked by" | sed "s/(.*//" | grep -oE '[0-9]{4}' || true); do
    blocker_file="$(git ls-tree --name-only origin/main docs/tickets/ | grep "^docs/tickets/$blocker-" || true)"
    blocker_status="$(git show "origin/main:$blocker_file" | field Status)"
    case "$blocker_status" in
      done*) ;;
      *) echo "claim: $slug is blocked by $blocker, which is ${blocker_status:-missing}." >&2; exit 1 ;;
    esac
  done

  git worktree remove --force "$scratch/main" >/dev/null 2>&1 || true
  git worktree add --quiet --detach "$scratch/main" origin/main
  sed -e "s/^\*\*Owner:\*\*.*/**Owner:** $owner/" \
      -e "s/^\*\*Status:\*\*.*/**Status:** in-progress/" \
      "$scratch/main/$ticket" > "$scratch/ticket.md"
  mv "$scratch/ticket.md" "$scratch/main/$ticket"
  # The pre-commit hook refreshes docs/tickets/README.md from the ticket files.
  git -C "$scratch/main" add "$ticket"
  git -C "$scratch/main" commit --quiet -m "claim $number"
  if git -C "$scratch/main" push --quiet origin HEAD:main; then
    claim_commit="$(git -C "$scratch/main" rev-parse HEAD)"
    git fetch --quiet origin main
    if git show-ref --quiet "refs/heads/$slug"; then
      echo "claimed $slug on main. Branch $slug already exists; merge origin/main into it."
    else
      git branch --quiet "$slug" "$claim_commit"
      echo "claimed $slug on main and created branch $slug."
      echo "next: git switch $slug   (in a worktree session: git merge origin/main, then push with git push origin HEAD:$slug)"
    fi
    echo "post \"taking $number\" in the group chat."
    exit 0
  fi
  echo "claim: main moved while claiming (attempt $attempt); checking again." >&2
done

echo "claim: could not push the claim after 3 tries; pull main and try again." >&2
exit 1
