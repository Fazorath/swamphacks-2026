# 0051: Road Routes in the valley (stretch)

**What to build:** The Cache Pack build runs the existing Route builder over the Nepal OSM extract for the valley box, so a reachable Shelter gets a line on the map, as Gainesville Shelters did. Routes that run through the Flood-Prone Area are left out.

**Blocked by:** 0043, 0048

**Status:** in-progress

**Owner:** refloow-0

**Spec:** `docs/specs/flash-flood-replay.md`

- [x] The build downloads the Geofabrik `asia/nepal` extract and builds Routes for the valley box within the existing budget
- [x] A Route that crosses the river corridor is dropped, and the plan falls back to straight-line walking time
- [x] The Evacuation Plan draws the Route to the chosen Shelter when one exists
- [x] Seam B tests: a Route through the Flood-Prone Area is not drawn
- [ ] All **Commands** pass
