# 0066: Warning choreography on the map

**What to build:** On the desktop God's Eye View, a new Community Warning takes over without dimming the map: the origin Node flashes with its ring, a 120 px band slides in at the top and the chime plays, the camera flies flat to the Surging Node and then tilts, and the wave starts while the Wave ETA corner card (0072) counts down. Acknowledge lives in the Alerts Panel only; afterwards a chip beside the Flood Risk chip keeps the warning in view. The phone Warning Takeover (0039) is unchanged. Decisions D-22 to D-29 and D-55 in `docs/design/gods-eye-view-decisions.md`.

**Blocked by:** 0033, 0065, 0072

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("God's Eye View", "Warning Takeover"); canvas artboards `G-Warning-Moment` (band, comet, corner card, Alerts Panel with Acknowledge), `G-Warning-Acknowledged` (the chip, band gone) and `G-Wave-Arrival`.

- [ ] A new Community Warning or Official Alert shows the band at the top under the top bar, 120 px tall (D-22), with its tag (`COMMUNITY WARNING · NOT OFFICIAL` or `OFFICIAL`), the warning sentence and the fixed "check official sources" line; a Community band has a 12% violet tint and the dashed violet edge (D-23); the map is never dimmed
- [ ] The band carries no button: Acknowledge is the card in the Alerts Panel only, and the band stays until that card is acknowledged (D-27)
- [ ] The "wave started" beat: the origin Node pulses red with its ring, the band slides in, the camera starts to fly and the chime plays, all within the same second (D-28)
- [ ] The two-note chime plays once on a page that has been tapped; the band's border pulses twice over 3 s in time with the two notes, never a strobe (D-55); with reduced motion on there is no pulse and the camera jumps instead of flying
- [ ] The camera flies flat (zoom and pan in 2D) to the Surging Node, then the pitch eases to the valley angle over 1.5 s (D-26, D-30), then settles on the valley; a user who has panned is not fought for more than the one fly
- [ ] The Wave ETA countdown is the corner card from 0072, shown from the moment the band appears; nothing is drawn over the home town's marker (D-24)
- [ ] Acknowledgement is per device and per warning id, as in 0039; after it the band goes, the card stays in the Alerts Panel with its "Acknowledged" check, and a violet dashed chip "WARNING · 35 MIN" (the minutes live) sits in the top bar beside the Flood Risk chip and reopens the card; no banner under the top bar (D-29)
- [ ] If an Official Alert and a Community Warning are both pending, Official shows first ("1 of 2")
- [ ] Vitest flow test: the warning arrives, the band shows without a button, the map keeps its opacity, acknowledging from the Alerts Panel hides the band and shows the chip
- [ ] All **Commands** pass
