# 0010: Route to the Shelter

**What to build:** The Evacuation Plan draws a route on the map from the resident's home to their chosen Shelter, with no internet and no map app.

**Blocked by:** 0009

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

- [x] The Cache Pack build script adds precomputed routes: a grid of points over the area, with a route from every grid point to every Shelter, from the Geofabrik Florida OSM extract
- [x] The Evacuation Plan picks the route from the grid point nearest home to the chosen Shelter
- [x] The Evacuation Plan ranks Shelters by road distance from the routes instead of 0009's straight-line distance, and shows the distance as a route length
- [x] The dashboard draws the route on the map
- [x] Seam B tests: the route starts at the grid point nearest home and ends at the chosen Shelter
- [ ] Manual check: the route shows on a phone with the internet off
- [x] All **Commands** pass
