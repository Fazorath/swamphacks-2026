# 0041: Dashboard reads the state snapshot

**What to build:** The dashboard shows this Node's identity and status, every Node's readings and Flood Risk from one `GET /api/state`, polled every second, with a neutral "Connecting…" until the first answer. The old calls and the hooks that used them are removed, not left beside the new one. Nothing a resident sees changes except that the Node card and the risk chip now always come from the same instant.

**Blocked by:** 0040

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/state-snapshot.md`

- [x] One `useNodeState()` is called once in `App` and its pieces are passed down as props; it polls with a chained timeout so requests never overlap
- [x] Before the first answer the dashboard shows "Connecting…", not an error
- [x] `/api/node`, `/api/readings`, `/api/readings/stream`, `/api/flood-risk` and `GET /api/scenario`, and the hooks that used them (`useNodeIdentity`, `useNodeStatus`, `useReadings`, `useFloodRisk`), are deleted
- [x] Seam A test: the removed endpoints answer 404
- [x] The dashboard's own 15 s Stale constant is deleted; it reads `stale` from the state
- [x] The Scenario step and reset buttons keep working and the screen updates within a second
- [x] Tests that used the old endpoints now use `/api/state`
- [x] Vitest: the dashboard renders from a fake `/api/state`, and shows "Connecting…" before the first answer
- [x] All **Commands** pass
