# 0047: The wave's ETA counts down at home

**What to build:** When a Community Warning arrives, each Viewer works out how long the wave takes to reach its home and counts down on the Event clock ("Wave expected at your home in about 9 min"). The home comes from the Household Profile, or the connected Node's position when there is no profile, and never leaves the device.

**Blocked by:** 0013, 0043

**Status:** done

**Owner:** leonardorofaDV

**Spec:** `docs/specs/flash-flood-replay.md`

**Design:** `docs/design/ui.md` ("Evacuation Plan Panel", "Alerts Panel")

- [x] The Evacuation Plan snaps the home to the river line in the Cache Pack and adds up travel time through each reach from the warning's `origin_km`
- [x] The countdown follows the Event clock, pauses when the Replay pauses, and shows "wave expected now" at or past zero, never a negative number
- [x] A home upstream of the origin gets no ETA
- [x] The ETA leads the Evacuation Plan Panel and the Community Warning card
- [x] Seam B tests: ETA from origin River km and reach speeds; countdown reaches "wave expected now"; no ETA upstream; no request carries the home location
- [x] All **Commands** pass
