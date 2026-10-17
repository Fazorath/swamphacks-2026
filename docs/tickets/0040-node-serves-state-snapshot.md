# 0040: Node serves one state snapshot

**What to build:** `GET /api/state` returns, in one consistent object, this Node's `id`, name, role and `online` / `mesh_only` status, the Scenario step, Flood Risk, and every Node's latest readings grouped per Node with `age_s`, `stale` (silent for 15 s) and the simulated flag. The Node decides which Nodes are Stale, and the 15 s and 60 s thresholds sit side by side in the Node's one timing module. The old endpoints stay for now, so nothing in the dashboard breaks while the new one lands; the next ticket moves the dashboard over and deletes them.

**Blocked by:** 0003, 0006 (both done)

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/state-snapshot.md`

- [ ] `GET /api/state` shows this Node's own readings and other Nodes' readings, grouped per Node, each with its fuzzed position, simulated flag, `age_s` and `stale`
- [ ] It carries `id`, name, role, `online` / `mesh_only` status and the Scenario step
- [ ] It carries Flood Risk (level, reasons, Storm Signal, per-Node levels) computed from the same readings in the same response
- [ ] Fields that belong to later tickets (Official Alerts, Community Warnings, Shelter ids, `registered`) are not added
- [ ] The 15 s Stale threshold and the 60 s "stops counting" threshold live in one place on the Node, and Flood Risk and `stale` both read it
- [ ] Seam A tests: the state shows own and other Nodes' readings; a Node that stops publishing turns `stale` after 15 s with a growing `age_s`; Flood Risk in the state agrees with the readings in the same response
- [ ] All **Commands** pass
