# 0024: Tidy the Community Reading mapping (cleanup)

**What to build:** The review of 0003 found code that works but is spread thinner than it should be. Converting between the wire format and what the API shows (metres and centimetres, kind and unit names) is split between `community_reading.py` and `reading_store.py`, so a change to a unit has to be made in two places. Do these small cleanups together once other tickets stop touching these files, and change no behaviour.

**Blocked by:** 0003

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] Turning a Community Reading into displayed readings lives on `CommunityReading`, next to `from_measurements`, so the kind, unit and scale tables are in one module
- [ ] `ReadingStore` holds a small named record instead of a `(reading, received_at)` tuple that it indexes into
- [ ] A fuzzed position has one small type instead of a bare `(float, float)` passed around
- [ ] The one-line `store_reading_from` wrapper and the repeated `datetime.now(UTC)` calls are gone
- [ ] `create_app` hands the publish loop and sequencing to a small unit of its own
- [ ] The Mesh parameters say Community Reading where only readings flow
- [ ] All existing tests pass unchanged, plus **Commands**
