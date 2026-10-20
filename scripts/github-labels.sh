#!/usr/bin/env bash
# Creates or updates the repo's issue labels and roadmap milestones on GitHub, so the
# tracker matches docs/agents/issue-tracker.md and docs/roadmap.md. Safe to rerun.
# Runs from .github/workflows/github-setup.yml when this file changes on main; by hand:
#   GH_REPO=<owner>/<repo> scripts/github-labels.sh   (needs an authenticated gh)
set -euo pipefail

: "${GH_REPO:?set GH_REPO=<owner>/<repo>}"

label() {
  gh label create "$1" --color "$2" --description "$3" --force
}

label "area: node" 1d76db "Node service (node/)"
label "area: dashboard" 5319e7 "Dashboard (dashboard/)"
label "area: mesh" 0e8a16 "Mesh and Reticulum transport"
label "area: hardware" b60205 "Pi, Breadboard, sensors"
label "area: workflow" c5def5 "Scripts, CI, hooks, agent skills, docs"
label "bug" d73a4a "Something is broken"
label "feature" a2eeef "New behaviour a user can see"
label "chore" ededed "Cleanup, refactor, tooling; no new behaviour"
label "review-finding" fbca04 "Found by code-review; grouped by root cause"
label "priority: high" e11d21 "Do this before anything else in its milestone"
label "good first issue" 7057ff "Small and self-contained; good for a new contributor"

# Title, due date, description. Due dates are targets, not deadlines.
milestones=(
  "M0 Setup|2026-10-26|GitHub Issues, CI, branch protection, Claude workflow"
  "M1 Review|2026-10-26|code-review of the rushed final-day code; findings filed as issues"
  "M2 Cleanup|2026-11-16|Review findings, test flakes, demo code isolated from the core"
  "M3 Direction|2026-11-23|Grill and spec the local-first sensor direction and the simulated-range mesh"
  "M4 Simulated mesh|2026-12-07|Placeholder Nodes with a radio range, visible on the map"
)

existing="$(gh api "repos/$GH_REPO/milestones?state=all&per_page=100" --jq '.[] | "\(.number)|\(.title)"')"
for entry in "${milestones[@]}"; do
  IFS='|' read -r title due description <<<"$entry"
  number="$(awk -F'|' -v t="$title" '$2 == t { print $1 }' <<<"$existing")"
  if [ -n "$number" ]; then
    gh api -X PATCH "repos/$GH_REPO/milestones/$number" \
      -f description="$description" -f due_on="${due}T23:59:59Z" >/dev/null
    echo "updated milestone $title"
  else
    gh api -X POST "repos/$GH_REPO/milestones" \
      -f title="$title" -f description="$description" -f due_on="${due}T23:59:59Z" >/dev/null
    echo "created milestone $title"
  fi
done
