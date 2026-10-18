# 0016: Breadboard drives the Scenario on the Pi

**What to build:** On stage, the presenter presses breadboard buttons and flips switches on the Raspberry Pi (pressure drop, rain, water rising, reset), and the Pi's Sensor Node steps its Scenario. The Pi also runs the Wi-Fi hotspot that every laptop and phone joins.

**Blocked by:** 0002

**Status:** done

**Owner:** amitathik7

**Spec:** `docs/specs/storm-shield.md`, `docs/specs/breadboard-drives-the-scenario.md`

**Design:** `docs/design/ui.md` ("Node Panel"); canvas artboard `D-Node-Scenario`.

- [x] Four GPIO inputs (a wire from 3.3 V to a pin) jump the Scenario to pressure drop, rain and water rising, or reset it, on the Pi (tested with mock pins)
- [x] On a non-Pi machine the Node starts without GPIO and falls back to keyboard/HTTP steps
- [x] The Pi runs its own Wi-Fi hotspot with no internet; setup notes are kept next to the code (`pi/setup-hotspot.sh`, `pi/install.sh` and `pi/README.md`; confirmed on the real Pi by the owner on 2026-10-18)
- [x] A wiring diagram or pin table is kept next to the code (`pi/README.md`)
- [x] Manual check: each button press changes the Pi's readings on a laptop dashboard joined to the hotspot (confirmed on the real Pi by the owner on 2026-10-18)
- [x] All **Commands** pass
