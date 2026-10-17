# 0022: A restarted Node is heard again, whatever its clock says

**What to build:** Receivers ignore a reading whose `seq` they have already seen, which also means a restarted Node (whose counter starts over) is ignored until it catches up. 0003 avoids that by starting the counter at the current clock time, but the Pi has no battery clock (`docs/specs/wire-formats.md`), so after a reboot with a wrong, earlier clock its readings would be ignored by every peer, in the middle of the demo. Make the receiving rule robust instead: an old `seq` is ignored only while the last reading from that Node is still fresh, and a Node that has been silent long enough is accepted again from any `seq`.

**Blocked by:** 0019

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/storm-shield.md`

- [ ] `seq` starts at 0 and goes up by one per reading, as the wire doc says; the clock-seeded start is removed
- [ ] A repeated or older `seq` from a Node heard within the stale window (15 s) is ignored
- [ ] A reading from a Node silent for longer than the stale window is accepted whatever its `seq`
- [ ] Seam A tests: a duplicate `seq` is ignored; an older `seq` is ignored; a Node that restarts after the stale window is heard again; a restart with a lower `seq` than before is heard again
- [ ] All **Commands** pass
