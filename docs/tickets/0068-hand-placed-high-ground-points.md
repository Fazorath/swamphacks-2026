# 0068: Hand-placed high-ground points

**What to build:** Near Syabrubesi, Betrawati and Trishuli the map shows one or two hand-placed high-ground points, each with an arrow and a line such as "+90 m above the river, 11 min uphill". When the Evacuation Plan says "get to higher ground", the nearest point is highlighted.

**Blocked by:** 0035, 0063

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** refloow-0

**Spec:** `docs/specs/gods-eye-view.md`

- [ ] A high-ground file in the Cache Pack: for each point, name, position, height above the river read from the elevation data, walking time uphill (the Evacuation Plan's detour factor and speed), a source note and a check date; the points are placeholders until someone checks them against the terrain
- [ ] The map draws each point as a marker with an arrow and its climb line; the points are never inside the Flood-Prone Area
- [ ] With no Wave ETA reachable Shelter (the "No Shelter you can reach in time" state), the plan names the nearest high-ground point and highlights it on the map
- [ ] A test checks the climb line from fixed numbers and that a point inside the Flood-Prone Area is refused by the build
- [ ] A later idea, not built here: points submitted by trusted contributors and checked against elevation data
- [ ] `scripts/check.sh` passes
