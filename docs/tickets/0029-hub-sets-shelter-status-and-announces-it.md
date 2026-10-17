# 0029: Hub sets a Shelter's status and announces it

**What to build:** On the Hub, an operator closes or opens a Shelter through the API and every Node's open list follows within seconds, then stays correct because the Hub repeats the full status every 30 seconds. Demonstrable with `curl` against a loopback Hub and Sensor, no dashboard needed.

**Blocked by:** 0028

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/shelter-status.md`

- [x] `POST /api/shelters/open` on the Hub takes `{ "id": "...", "open": true|false }`, updates the Hub's own list at once, publishes a full snapshot with a higher `ver` and returns the resulting open list
- [x] An unknown Shelter id gets 422; the route does not exist (404) on a Sensor Node; the Hub refuses changes (with a clear error) until it holds a valid Cache Pack
- [x] Once the Hub has a pack it starts with every Shelter in it open at `ver` 1 and announces that
- [x] The Hub repeats its current snapshot every 30 s with the same `ver`, so a Node that joins late or missed a packet converges
- [x] Seam A tests: a status set on the Hub shows up on every Node; a Shelter closed on the Hub drops out everywhere; a late-joining Node converges after a repeat; a Sensor answers 404
- [x] Rehearsed on loopback: close a Shelter on the Hub with `curl` and watch a Sensor's `/api/shelters` change (not a Pi check)
- [x] All **Commands** pass
