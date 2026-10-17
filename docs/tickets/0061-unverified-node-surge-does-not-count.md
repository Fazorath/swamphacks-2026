# 0061: An Unverified Node's Surge does not count

**What to build:** Once 0012 makes `_counts` ignore Unverified Nodes, check that a Surge from one is ignored everywhere a Surge is read: it does not make Flood Risk High, does not appear in `surged` or as a `water_surge` reason, and cannot trigger a Community Warning. This is the Seam A test that ticket 0046 left out until the registry existed.

**Blocked by:** 0012

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/flash-flood-replay.md`

- [ ] Seam A test (with `MeshedNodes.hear_from`): a 100 cm jump from an Unverified Node leaves `surged` empty, adds no `water_surge` reason and does not raise Flood Risk; the same jump from a Registered Node does all three
- [ ] If the test finds Flood Risk still counting the Surge, `_counts` in `flood_risk.py` is fixed in this ticket
- [ ] All **Commands** pass
