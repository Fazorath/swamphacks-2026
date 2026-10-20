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

# Title | due date (empty for none) | open or closed | description | earlier title to rename.
# Due dates are targets, not deadlines.
milestones=(
  "M0 Setup|2026-10-26|closed|GitHub Issues, CI, branch protection, Claude workflow|"
  "M1 Review|2026-10-26|closed|code-review of the rushed final-day code; findings filed as issues|"
  "Hackathon findings||open|Review findings in the hackathon code; close each when a change fixes it or makes it moot|M2 Cleanup"
  "M2 Direction|2026-11-02|open|Grill and spec modular Regions, scenarios and the Sandbox|M3 Direction"
  "M3 Sandbox||open|One command or button: Hub and simulated sensors in one process from a scenario file|M4 Simulated mesh"
  "M4 Regions||open|Nepal behind the Region module; a section of Florida as the second region|"
  "M5 Wave on any region||open|The event plays on whichever region is loaded|"
)

existing="$(gh api "repos/$GH_REPO/milestones?state=all&per_page=100" --jq '.[] | "\(.number)|\(.title)"')"
number_of() { awk -F'|' -v t="$1" '$2 == t { print $1 }' <<<"$existing"; }

for entry in "${milestones[@]}"; do
  IFS='|' read -r title due state description was <<<"$entry"
  due_on=null
  [ -n "$due" ] && due_on="\"${due}T23:59:59Z\""
  body="$(jq -n --arg title "$title" --arg state "$state" --arg description "$description" \
    --argjson due_on "$due_on" '{title: $title, state: $state, description: $description, due_on: $due_on}')"
  number="$(number_of "$title")"
  [ -z "$number" ] && [ -n "$was" ] && number="$(number_of "$was")"
  if [ -n "$number" ]; then
    gh api -X PATCH "repos/$GH_REPO/milestones/$number" --input - <<<"$body" >/dev/null
    echo "updated milestone $title"
  else
    gh api -X POST "repos/$GH_REPO/milestones" --input - <<<"$body" >/dev/null
    echo "created milestone $title"
  fi
done
