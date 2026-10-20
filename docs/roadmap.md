# Roadmap after SwampHacks

Storm Shield started as a hackathon demo: a flood warning dashboard replaying the 26 August 2026 Bhote Koshi flood in Nepal, with Community Readings that keep flowing over a local Mesh when the internet goes down. The submitted demo is tagged `v0-swamphacks` and stays runnable from that tag.

Where it goes next: an open-source, local-first sensor network you run yourself (a farm, remote land, a stretch of river), where no outside service holds your cameras, sensors or data. The app becomes **modular**: load a region (a section of Florida, say), place a few test sensors, and play an event such as a flood wave arriving, instead of the hard-wired Nepal valley.

Progress is tracked in the GitHub milestones of the same names. Pace: one issue per person per week, about four a week for the team.

## How we get there

- **Reshape in place, don't rewrite.** The core (Node service, Mesh, readings, registry, signing, the MapLibre shell) is sound and tested. The Nepal-specific parts move behind a Region module one area at a time, with CI green throughout. What doesn't fit is deleted together with its tests.
- **Trying the app must not need a terminal.** Today a manual check means stopping Nodes, starting a pack server, a Hub and each Sensor with its own port and slot, and copying `HUB_IDENTITY`. The Sandbox (M3) replaces all of that with one command, or one button.
- **Tests during the redesign.** CI keeps running the tests that exist. A feature removed takes its tests with it in the same PR. New code is tested through one seam: load a scenario, run the Sandbox, check what the API or dashboard shows. No time goes into flaky tests or fixes for features that are about to go.

## M0 Setup (done)

GitHub Issues instead of `docs/tickets/` (a frozen archive), pull requests only, CI running `scripts/check.sh` on every PR, the real-Reticulum tests on demand in "Mesh integration" (so **a green PR says nothing about the real Mesh path**), and `/implement <N>` working from an issue in its own worktree with a draft PR. Owner settings: `docs/agents/github-setup.md`.

## M1 Review (done)

`/code-review` of the backend code rushed in on 18 Oct produced issues #7 to #19 (milestone "Hackathon findings"). They are a record, not a work queue: whoever reshapes an area checks its issues and closes the ones the change makes moot. Only problems that hurt day-to-day work get fixed for their own sake (`run-live.sh`, #11). The dashboard review was stopped halfway, because the region work replaces most of the map code it covered.

## M2 Direction

A grilling session, then a spec: what a Region is (map area, rivers and terrain, sensor sites, time zone, official sources), where its data comes from (a prebuilt pack, or fetched once and cached), what a scenario or event is, what the Sandbox does and how someone who doesn't use a terminal starts it, and what stays from the flood logic. Mock-ups of the new screens are shown for a yes or no before anything is built.

## M3 Sandbox

One command (or button) starts a Hub and N simulated sensors in one process on the in-memory Mesh, from a scenario file: no ports per Node, no pack server, no identity copying. It is also the base for the automated tests and for the simulated radio range (a message reaches only Nodes in range).

## M4 Regions

The Nepal valley moves behind the Region module, and a section of Florida is added as the second region, which proves the modularity.

## M5 Wave on any region

The event plays on whichever region is loaded: the wave front, Surges, warnings.

Dates for M3 to M5 are set when M2 ends.

## Not planned yet

Real sensors and radios, LoRa, a hosted anything. Ideas go in as issues with no milestone.
