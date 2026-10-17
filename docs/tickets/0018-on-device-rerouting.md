# 0018: On-device rerouting (stretch)

> **Parked.** Road Routes are no longer in the demo's main path (`docs/specs/flash-flood-replay.md`); pick this up only after 0051.
>
> Picked up before 0051 on request; the road-graph half of 0051 is folded in here (`build_cache_pack.py --roads-pbf`). 0051's precomputed valley Route lines and corridor rule stay in 0051.

**What to build:** If the precomputed route crosses a Flood-Prone Area or a road a resident marks as blocked, the phone finds a different route to the Shelter itself, with no internet.

**Blocked by:** 0010

**Status:** done

**Owner:** leonardorofaDV

**Spec:** `docs/specs/on-device-rerouting.md`

- [x] The Cache Pack includes the road graph needed to route on the phone
- [x] The resident can mark a road as blocked on the map
- [x] The Evacuation Plan reroutes around blocked roads and, where possible, Flood-Prone Areas
- [x] Seam B tests: a blocked segment on the precomputed route produces a route that avoids it
- [x] All **Commands** pass
