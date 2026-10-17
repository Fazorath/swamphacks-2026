# 0050: Measured wave speed with the arithmetic shown (stretch)

**What to build:** Once a second Registered Node surges, the Hub measures the wave's speed from the River km and Surge times of the two, and every Viewer's ETA for reaches below them uses that speed instead of the reconstructed one. The warning card shows the arithmetic ("15.6 km in 12 min = 78 km/h").

**Blocked by:** 0013, 0047

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/flash-flood-replay.md`

- [x] The Hub sends an updated Community Warning with the second Node and the measured speed; it does not count as a new warning for the Warning Takeover
- [x] ETAs below the second Node use the measured speed; reaches above keep the reconstructed ones
- [x] The card shows distance, time and speed
- [x] Seam A tests: a second Surge produces the measured speed; Seam B tests: the ETA uses it
- [x] All **Commands** pass
