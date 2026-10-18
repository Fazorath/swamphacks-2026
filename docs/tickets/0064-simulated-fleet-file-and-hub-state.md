# 0064: Simulated Fleet file and Hub state

**What to build:** The Cache Pack carries a fleet file of about 40 sites along Nepal's rivers (about 30 towns and 10 headwater sites), each with a track of Simulated Readings built from real Open-Meteo weather at its own position for the Replay's window. Every Node that holds the pack serves them in the state snapshot, in a `fleet` array apart from `nodes`, following its own Event clock. They never touch the Mesh, Flood Risk, a Community Warning or the Node registry. Decided in the grill on 2026-10-18; formats in `docs/specs/wire-formats.md` → "Simulated Fleet".

**Blocked by:** None

Positions are typed, not snapped to the river line of the ticket before it in the spec; 0035 checks them on the map.

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** refloow-0

**Spec:** `docs/specs/gods-eye-view.md`

- [ ] `scripts/cache-pack/fleet.source.json`, hand-written: id (`fleet-<slug>`), name, river name (no River km), `site` (`town` or `headwater`), lat/lon and where each came from. About 30 town sites at population centres on the main rivers and tributaries, about 10 headwater sites at glacial lake outlets, glacier fronts and upper valleys. None on the Bhote Koshi–Trishuli or in the Langtang Khola catchment; the build fails if two sites sit within 15 km
- [ ] The build asks the Open-Meteo archive for every fleet position in one request and writes `fleet.json` with a point every 30 event seconds from 08:30 to 10:30: rain, soil moisture and pressure from Open-Meteo; water = calm base + gain × rain of the previous 24 h, and the file says it is modelled. Headwater sites stay calm; the two or three town sites with the most real rain rise, below the Surge size and the High threshold; one town site goes silent at about 09:40. The build fails if no site had rain enough to rise. The file and its checksum go in the manifest and it notes its sources
- [ ] `/api/state` on every Node lists `fleet`, sorted by id: `{id, name, river, site, position, age_s, stale, measurements}`, the reading at the Event clock; with no Replay heard, the calm start; a pack without `fleet.json` gives `fleet: []`. `age_s` is `(event_now − last_point_t) / rate`, so the silent site turns Stale 15 s after its `silent_at`
- [ ] A test with a Surging fleet entry shows no `water_surge` reason, no High, no Community Warning and nothing on the Mesh; `POST /api/registry/accept` with a fleet id answers 404 and leaves the registry unchanged
- [ ] The state snapshot test lists the new `fleet` field (`test_state_snapshot.py` changes)
- [ ] `scripts/check.sh` passes
