# 0040: Node serves one state snapshot

**What to build:** `GET /api/state` returns, in one consistent object, this Node's `id`, name, role and `online` / `mesh_only` status, the Scenario step, Flood Risk, and every Node's latest readings grouped per Node with `age_s`, `stale` (silent for 15 s) and the simulated flag. The Node decides which Nodes are Stale, and the 15 s and 60 s thresholds sit side by side in the Node's one timing module. The old endpoints stay for now, so nothing in the dashboard breaks while the new one lands; the next ticket moves the dashboard over and deletes them.

**Blocked by:** 0003, 0006 (both done)

**Status:** done

**Owner:** leonardorofaDV

**Spec:** `docs/specs/state-snapshot.md`

- [x] `GET /api/state` shows this Node's own readings and other Nodes' readings, grouped per Node, each with its fuzzed position, simulated flag, `age_s` and `stale`
- [x] It carries `id`, name, role, `online` / `mesh_only` status and the Scenario step
- [x] It carries Flood Risk (level, reasons, Storm Signal, per-Node levels) computed from the same readings in the same response
- [x] Fields that belong to later tickets (Official Alerts, Community Warnings, Shelter ids, `registered`) are not added
- [x] The 15 s Stale threshold and the 60 s "stops counting" threshold sit side by side in one timing module on the Node; `stale` reads the 15 s value now, and the 60 s value waits for 0021 to wire it into Flood Risk (`_counts()` stays `True` here)
- [x] Each Node entry is `{id, position: [lat, lon], simulated, age_s, stale, measurements}`, with `measurements` an object keyed by kind (`pressure`, `rain_rate`, `water_level`, `soil_moisture`), each `{value, unit}`; entries are sorted by `id`, this Node is not flagged (the dashboard compares `id`), and a Node with no reading yet is absent
- [x] The Node entries and Flood Risk come from one lock and one `now` in `ReadingStore`, so they cannot disagree
- [x] Seam A tests: the state shows own and other Nodes' readings; a Node that stops publishing turns `stale` after 15 s with a growing `age_s`; Flood Risk in the state agrees with the readings in the same response
- [x] All **Commands** pass
