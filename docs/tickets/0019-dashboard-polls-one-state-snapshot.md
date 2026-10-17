# 0019: Dashboard polls one state snapshot

**What to build:** The dashboard reads everything it shows from one `GET /api/state` that it polls every second, as `docs/specs/wire-formats.md` ("Node HTTP API") describes, and shows "Node unreachable" when the Node stops answering. This replaces the separate `/api/node`, `/api/readings` and `/api/readings/stream` calls from 0001 and 0002, so later tickets add fields to one object instead of new endpoints and streams.

**Blocked by:** 0003

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] `GET /api/state` returns, in one consistent object: this Node's name, role and `online` / `mesh_only` status, the Scenario step, and every Node's latest readings with `age_s`, `stale` (silent for 15 s) and the simulated flag
- [ ] Fields that belong to later tickets (Flood Risk, Official Alerts, Community Warnings, Shelters, `registered`) are not added here; each of those tickets adds its own to the same object
- [ ] The dashboard polls `/api/state` every second and shows "Node unreachable" when it stops answering
- [ ] `/api/node`, `/api/readings`, the readings stream and the hooks that used them are removed, not left beside the new call
- [ ] The stale threshold lives in one place, so 0005 and 0006 read the same value
- [ ] Seam A tests: the state a Node serves shows its own readings and other Nodes' readings, and a Node that stops publishing turns stale
- [ ] Vitest: the dashboard renders from a fake `/api/state` and shows the unreachable state when the fetch fails
- [ ] All **Commands** pass
