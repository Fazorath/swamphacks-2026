# 0039: Warning Takeover and Join card

**What to build:** A new Official Alert or Community Warning takes over the screen until the resident acknowledges it, then stays visible as a banner and in the Alerts Panel. The desktop hand-off card shows two QR codes so a phone can join the hotspot and open the dashboard, generated in the browser so it works offline.

**Blocked by:** 0013, 0014

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Warning Takeover", "Join card", "Evacuation Plan Panel" first row); canvas artboards `C-Takeover`, `C-Join`, `D-Takeover-Official`, `D-Takeover-Community`, `P-Takeover`, `P-Takeover-Community`.

- [ ] Desktop: an 880 px card centred over the live map dimmed to 40%, with a full-width 64 px Acknowledge button; phone: a full-screen sheet
- [ ] Official keeps the light panel with the solid blue OFFICIAL tag; Community keeps the violet dashed edge, `COMMUNITY WARNING · NOT OFFICIAL` and the fixed "Check official sources for any evacuation decision." line
- [ ] If both are pending, Official shows first, then Community ("1 of 2")
- [ ] Acknowledgement is stored per device in the browser, keyed by the warning's id; a new warning opens the takeover again, the same one does not
- [ ] After acknowledging, a banner stays under the top bar and the card stays in the Alerts Panel; a warning never silently disappears
- [ ] One short two-note chime when the takeover opens, on a page that has been tapped once; it never loops; the border pulses slowly, and not at all with reduced motion
- [ ] Join card: one `WIFI:` QR and one dashboard-URL QR from `qrcode-generator` 2.0.4, shown in the "Your plan lives on your phone" hand-off card on a desktop with no Household Profile
- [ ] Vitest tests: takeover order, acknowledgement persistence per id, Join card payloads
- [ ] Manual check: a phone scans the QR codes over the local Wi-Fi (rehearsal, not a Pi check)
- [ ] All **Commands** pass
