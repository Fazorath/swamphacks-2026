# 0016: Breadboard drives the Scenario on the Pi

**What to build:** On stage, the presenter presses breadboard buttons and flips switches on the Raspberry Pi (pressure drop, rain, water rising, reset), and the Pi's Sensor Node steps its Scenario. The Pi also runs the Wi-Fi hotspot that every laptop and phone joins.

**Blocked by:** 0002

**Status:** in-progress

**Owner:** amitathik7

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Node Panel"); canvas artboard `D-Node-Scenario`.

- [ ] Digital GPIO buttons and switches map to Scenario steps and reset on the Pi
- [ ] On a non-Pi machine the Node starts without GPIO and falls back to keyboard/HTTP steps
- [ ] The Pi runs its own Wi-Fi hotspot with no internet; setup notes are kept next to the code
- [ ] A wiring diagram or pin table is kept next to the code
- [ ] Manual check: each button press changes the Pi's readings on a laptop dashboard joined to the hotspot
- [ ] All **Commands** pass
