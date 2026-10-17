# 0020: A Node's readings are published in order

**What to build:** A Node never publishes an older reading after a newer one. Today a Scenario step (a request thread) and the 3-second tick (the event loop) both read the Scenario and then take the next `seq` with no lock between them, so a tick that read the old state can get its `seq` after the step and win, hiding the step's reading until the next tick. On stage that would delay the "pressure drop" by up to 3 seconds. The Scenario itself and the in-memory Mesh's listener list are also unsynchronised.

**Blocked by:** 0003

**Status:** in-progress

**Owner:** refloow-0

**Spec:** `docs/specs/storm-shield.md`

- [ ] Reading the Scenario and taking the next `seq` happen as one step that two threads cannot interleave
- [ ] Stepping and resetting the Scenario cannot race with a publish
- [ ] Registering a listener on the in-memory Mesh is safe while messages are being delivered
- [ ] Seam A test: many steps and ticks from several threads never leave another Node showing a reading older than the Scenario step it was last told about
- [ ] All **Commands** pass
