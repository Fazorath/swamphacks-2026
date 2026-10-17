# 0030: Hub remembers Shelter status across a restart

**What to build:** A Hub that restarts keeps the Shelters the operator closed, and Nodes keep believing it, because its `ver` never goes backwards.

**Blocked by:** 0029

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/shelter-status.md`

- [ ] The Hub saves `ver` and the open list in its data directory on every change and loads them at startup
- [ ] After a restart the Hub announces the saved list at a `ver` higher than any it announced before, and does not reseed all-open
- [ ] A saved Shelter that is no longer in the Cache Pack is dropped from the list
- [ ] Seam A tests: close a Shelter, restart the Hub, and every Node still shows it closed; the `ver` after the restart is higher than before
- [ ] All **Commands** pass
