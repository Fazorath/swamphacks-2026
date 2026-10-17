# 0008: Household Profile

**What to build:** A resident fills in a Household Profile on their phone once: home location (tapped on the map), housing type (site-built or mobile home/RV), and whether they need a special-needs or pet-friendly Shelter. It is still there next time they open the dashboard, and it never leaves their device.

**Blocked by:** 0005

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

- [ ] A Household Profile form with housing type, special-needs and pets
- [ ] Home location is set by tapping the map; no address lookup
- [ ] The profile is stored only in the Viewer's browser storage and survives a reload
- [ ] The profile is never sent to any Node (no request carries it)
- [ ] Storage failure shows a visible message instead of failing silently
- [ ] Vitest tests: saving and loading a profile round-trips; a missing profile prompts the resident to fill one in
- [ ] All **Commands** pass
