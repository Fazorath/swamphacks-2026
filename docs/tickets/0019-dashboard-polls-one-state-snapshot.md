# 0019: Dashboard polls one state snapshot

**What to build:** This is the umbrella; the work is split into 0040 to 0042 and this ticket is done when they have all merged. The dashboard reads everything it shows from one `GET /api/state` that it polls every second, as `docs/specs/wire-formats.md` ("Node HTTP API") describes, and shows "Node unreachable" when the Node stops answering. This replaces the separate `/api/node`, `/api/readings`, `/api/readings/stream` and `/api/flood-risk` calls, so later tickets add fields to one object instead of new endpoints and streams.

**Blocked by:** 0040, 0041, 0042 (0003 is done)

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/state-snapshot.md`

- [ ] `GET /api/state` returns, in one consistent object, this Node's `id`, name, role and `online` / `mesh_only` status, the Scenario step, Flood Risk, and every Node's latest readings grouped per Node with `age_s`, `stale` (silent for 15 s) and the simulated flag (0040)
- [ ] Fields that belong to later tickets (Official Alerts, Community Warnings, Shelter ids, `registered`) are not added here; each of those tickets adds its own to the same object
- [ ] The dashboard polls `/api/state` every second and shows "Node unreachable" when it stops answering (0041, 0042)
- [ ] `/api/node`, `/api/readings`, the readings stream, `/api/flood-risk`, `GET /api/scenario` and the hooks that used them are removed, not left beside the new call (0041)
- [ ] The stale threshold lives in one place, so 0005 and 0006 read the same value (0040)
- [ ] Seam A tests and Vitest tests as set out in 0040 to 0042
- [ ] All **Commands** pass
