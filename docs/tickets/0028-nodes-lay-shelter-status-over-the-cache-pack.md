# 0028: Nodes lay the Hub's Shelter status over the Cache Pack

**What to build:** Every Node keeps the latest Shelter status the Hub announced and lists as open only the Shelters the Hub has announced. A Node that has heard nothing shows no open Shelter, and the Evacuation Plan says "No open Shelter announced yet. Follow official sources." The 0009 placeholder that opened every Shelter is gone.

**Blocked by:** 0027

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/shelter-status.md`

- [ ] A Node keeps the announcement with the highest `ver`; an older or equal `ver` is ignored
- [ ] A Shelter missing from the latest announcement reads as closed; an id the Node's Cache Pack does not know is ignored
- [ ] A Node keeps the last announcement if the Hub goes quiet, and starts with none after its own restart
- [ ] `GET /api/shelters` returns only announced-open Shelters; the "every Shelter is open at startup" placeholder and its notes in `docs/agents/lessons.md` are removed
- [ ] Seam A tests with hand-published Hub messages: an announced Shelter shows on every Node; a closed one drops out; nothing is open before any announcement; an old `ver` does not undo a closure
- [ ] Seam B test: when the nearest Shelter is closed the plan picks the next nearest
- [ ] All **Commands** pass
