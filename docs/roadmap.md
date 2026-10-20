# Roadmap after SwampHacks

Storm Shield started as a hackathon demo: a flood warning dashboard replaying the 26 August 2026 Bhote Koshi flood, with Community Readings that keep flowing over a local Mesh when the internet goes down. Where it goes next: an open-source, local-first sensor network you run yourself (a farm, remote land, a village), where no outside service holds your cameras, sensors or data.

Before new features, the repo has to be easy for four part-time people and their agents to work in, and the code rushed in on the last day has to be checked. This file says what comes in which order and why. Progress is tracked in the GitHub milestones of the same names; the dates are targets, not deadlines.

**Pace:** one issue per person per week, about four a week for the team.

## M0 Setup (week of 20 Oct)

The hackathon tracker was markdown files on `main` and everyone pushed to `main` directly; the last day has 113 merge commits, many of them `merge main into X` a few minutes apart. From now on:

- **GitHub Issues** replace `docs/tickets/` (now a frozen archive). Labels, templates, milestones and the "who picks up what" table: `docs/agents/issue-tracker.md`.
- **Pull requests only.** `main` is protected; a PR needs CI green and the branch up to date with `main`, then it is squash-merged. No human approval is required for now; `/code-review` is the reviewer.
- **CI** (GitHub Actions) runs `scripts/check.sh` on every PR. The real-Reticulum tests run only on demand ("Mesh integration" workflow), so **a green PR says nothing about the real Mesh path**.
- **Agents:** `/implement <issue>` assigns you, works in its own worktree, opens a draft PR at once and merges `main` before every push; the pre-push hook refuses a push to `main` or from a branch behind it.
- The owner's GitHub clicks (org, transfer, branch protection, Project board): `docs/agents/github-setup.md`.

## M1 Review (week of 20 Oct)

The `/code-review` skill on everything that reached `main` since 18 Oct 00:00 (about 10,000 non-test lines, built in one rush without review), in three runs: `node/`, `dashboard/`, `scripts/` with `pi/`. Each run reports its token use before the next starts. False positives are dropped and findings are grouped by root cause into small `review-finding` issues in M2, after the owner has seen the list. The older, reviewed code gets one issue, "review core modules", for later.

## M2 Cleanup (weeks 2 to 4, target 16 Nov)

- The review findings.
- Dashboard test flakes (`evacuationFlow`, the timing failures in full parallel runs): `priority: high`, fixed, never skipped.
- **Demo isolated from the core.** The Nepal replay, Hub replay controls, Camera Clips, valley Cache Pack and Shelters stay, but behind a clear demo/replay boundary, so the core (Node, Mesh, readings, dashboard) stands on its own.
- `docs/agents/lessons.md` trimmed to gotchas that are still true (done in M0; keep it short).

How long M2 takes depends on what M1 finds; the target is revised when M1 ends.

## M3 Direction (week 4, target 23 Nov)

A grilling session and a spec for the local-first sensor direction: what a Node reads outside a flood, who runs a Hub, what stays from the flood product. Plus the spec for the simulated-range mesh below.

## M4 Simulated mesh (weeks 5 and 6, target 7 Dec)

There are no real sensors or radios yet (one Raspberry Pi), and the Reticulum path was the least reliable part of the demo. So: a run mode that starts placeholder Nodes on the map, each with a radio range (for example 200 ft), where a message reaches only Nodes in range; drag a Node out of range and watch it go Stale. Details (multi-hop relay, terrain, units) are decided in M3.

## Not planned yet

Real sensors and radios, LoRa, renaming the domain words away from floods, a hosted anything. Ideas go in as issues with no milestone.
