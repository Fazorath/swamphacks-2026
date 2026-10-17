# 0018: On-device rerouting (stretch)

**What to build:** If the precomputed route crosses a Flood-Prone Area or a road a resident marks as blocked, the phone finds a different route to the Shelter itself, with no internet.

**Blocked by:** 0010

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] The Cache Pack includes the road graph needed to route on the phone
- [ ] The resident can mark a road as blocked on the map
- [ ] The Evacuation Plan reroutes around blocked roads and, where possible, Flood-Prone Areas
- [ ] Seam B tests: a blocked segment on the precomputed route produces a route that avoids it
- [ ] All **Commands** pass
