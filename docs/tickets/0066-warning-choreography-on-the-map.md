# 0066: Warning choreography on the map

**What to build:** On the desktop God's Eye View, a new Community Warning takes over without dimming the map: a full-width band and a chime, the camera flies to the Surging Node, the wave starts, and the Wave ETA appears as a large countdown over the home town's marker. The Acknowledge button is on the band. The phone Warning Takeover (0039) is unchanged.

**Blocked by:** 0033, 0065

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("God's Eye View", "Warning Takeover"); canvas artboard to be drawn first.

- [ ] A new Community Warning or Official Alert shows the full-width band with its tag (`COMMUNITY WARNING · NOT OFFICIAL` or `OFFICIAL`), the fixed "check official sources" line and Acknowledge; the map is never dimmed
- [ ] The two-note chime plays once on a page that has been tapped; the border or band pulses slowly, never strobes; with reduced motion on there is no pulse and the camera jumps instead of flying
- [ ] The camera flies to the Surging Node, then settles on the valley; a user who has panned is not fought for more than the one fly
- [ ] The Wave ETA shows large over the home town's marker, counts down, escalates in colour as it shrinks and reads "wave expected now" at zero
- [ ] Acknowledgement is per device and per warning id, as in 0039; after it, a banner stays and the card stays in the Alerts Panel
- [ ] If an Official Alert and a Community Warning are both pending, Official shows first ("1 of 2")
- [ ] Vitest flow test: the warning arrives, the band shows, the map keeps its opacity, acknowledging hides the band but keeps the banner
- [ ] All **Commands** pass
