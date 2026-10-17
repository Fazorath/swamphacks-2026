# On-device rerouting

**Status:** ready-for-agent

Ticket: `docs/tickets/0018-on-device-rerouting.md`. Parent spec: `docs/specs/storm-shield.md` (the deferred "on-device rerouting" stretch). Formats: `docs/specs/wire-formats.md` ("Cache Pack"). Words follow `CONTEXT.md`.

## Problem Statement

A Route is precomputed: the shortest drive, blind to Flood-Prone Areas and to what is happening on the roads. In a flood a resident knows things the pack cannot: the bridge is under water, a tree is down on the road. Today the plan keeps drawing the line through it, and with no internet there is no map app to fall back on.

## Solution

The resident taps the map to mark a road as a **Blocked Road**. If the precomputed Route crosses a Blocked Road, or a Flood-Prone Area, the phone computes a new Route itself from the **Road graph** in the Cache Pack, with no internet and no request to any Node. The Evacuation Plan then draws and describes the new Route and may pick a different Shelter.

The build script adds `roads.json` to the pack for the demo area. Ticket 0051 (valley Routes) is still open; this ticket takes only its road-graph part, not its precomputed lines or its corridor-crossing rule.

## User Stories

1. As a resident, I want to tap a road on the map to mark it blocked, so that my plan stops sending me through it.
2. As a resident, I want a Blocked Road drawn on the map, so that I can see what I marked.
3. As a resident, I want to tap a Blocked Road again to unblock it, so that a mistake or a cleared road is easy to fix.
4. As a resident, I want my Blocked Roads kept on my phone after a reload, so that I don't re-enter them mid-evacuation.
5. As a resident, I want Blocked Roads never to leave my phone, so that my knowledge of my street stays private like my Household Profile.
6. As a resident, I want a new Route when my Route crosses a Blocked Road, so that I still reach a Shelter.
7. As a resident, I want the new Route to avoid Flood-Prone Areas where it can, so that I don't drive into the water.
8. As a resident, I want the plan to say when the Route still crosses a Flood-Prone Area, so that I know the risk of the only way left.
9. As a resident, I want a different Shelter chosen when blocks make another one quicker, so that I go to the best one, not the one that was nearest before.
10. As a resident, I want the plan to say how many Blocked Roads it went around, so that I trust it saw what I marked.
11. As a resident, I want a clear message when my blocks cut me off from every Shelter, so that I know to follow official sources rather than a line that does not exist.
12. As a resident, I want rerouting to work with no internet, so that it works in the storm.
13. As a resident, I want rerouting to start from my actual home, so that the line begins at my door.
14. As a resident, I want rerouting to reveal nothing beyond what ADR 0003 already allows (the Route file of my Grid point, asked for to see whether the Route is affected), so that my home and my Blocked Roads reach nobody.
15. As the pack builder, I want the build to write the Road graph into the pack with checksums, so that Nodes verify it like any other file.
16. As the pack builder, I want the graph to stay under about 2 MB, so that phones download it quickly.
17. As a developer, I want the search to be a plain function on a small graph, so that tests need no map or network.

## Implementation Decisions

- **Road graph file.** `roads.json` in the pack: `{ "nodes": [[lat, lon], ...], "edges": [[a, b, length_m, [[lat, lon], ...]?], ...] }` as in `wire-formats.md`. Every edge is two-way. Service roads are dropped. Built from the same `Roads` the Route builder uses, by a new `build_road_graph` in `scripts/pack_routes.py`; `build_cache_pack.py` gains an optional `--roads-pbf` argument (needs `uv sync --group build`) that reads the extract for the box and adds `roads.json`. Without the argument the pack has no graph, as today.
- **Rerouting module (deep, small interface).** `dashboard/src/rerouting.ts`: `rerouteHome({ graph, home, shelters, blocked, floodProne })` returns the open Shelters ranked by road length with their lines, or null when none is reachable. It hides graph indexing, nearest-node and nearest-edge lookup, edge removal for Blocked Roads, the Flood-Prone penalty and one Dijkstra from home to every Shelter. Edges whose midpoint lies inside a Flood-Prone polygon cost 10 times their length. Blocked Roads are removed outright.
- **Trigger.** The plan keeps the precomputed Route when it crosses neither a Blocked Road nor a Flood-Prone Area. Otherwise it calls `rerouteHome`, and the result replaces the Route and the Shelter ranking. A segment counts as on the Route when its middle lies within 15 m of it, so a side road that only meets the Route at a junction does not trigger a reroute. When the nearest Shelter has no Route at all and the resident has marked a road, the plan also reroutes, so the valley (which has no precomputed Routes) gets a line once a road is blocked. If there is no Road graph, nothing changes from today.
- **Blocked Road storage.** An array of edge identities (the two end-node coordinates) in the browser's local storage, next to the Household Profile, by the same pattern. It is never sent to a Node; the "no request carries the profile" test also asserts no request carries a Blocked Road.
- **A Blocked Road is a whole graph segment**, junction to junction, because bends are folded into it; two parallel segments between the same junctions share one identity.
- **Marking.** A "Block a road" mode on the map, like the home-pick mode: a tap blocks the nearest edge within about 50 m; a tap on a Blocked Road unblocks it. Blocked Roads draw as a heavy red dashed line.
- **Plan text.** "Rerouted around N blocked road(s)." and, when the line still crosses a Flood-Prone Area, "This route still crosses a Flood-Prone Area." When no Shelter is reachable: "Roads you marked as blocked cut off every Shelter. Follow official sources." The plan then falls back to the straight-line ranking with no line, as today for a Shelter without a Route.
- **Not built.** Live traffic, one-way rules, turn costs, sharing Blocked Roads over the Mesh, a different travel mode.

## Testing Decisions

- **Seam B (Vitest, dashboard):** `rerouting.test.ts` on a small hand-made graph: a Blocked Road on the precomputed path gives a Route that avoids it; a Flood-Prone Area is avoided when another way exists and still crossed when none does; a different Shelter wins when blocks make it quicker; blocks that cut off everything return null. A flow test: tap a Blocked Road, the line and text change, a reload keeps it, no request carries it, and no request carries a Blocked Road or the home.
- **Python (pytest):** `build_road_graph` on a tiny `Roads`: service roads dropped, edge lengths right, the file is listed in the manifest and passes the Node's checksum check. The real Nepal extract is not run in tests.
- Existing seams only: the dashboard flow tests and `test_pack_routes.py`.

## Out of Scope

Precomputed valley Route lines and the river-corridor rule (0051); sharing blocks; one-way streets.
