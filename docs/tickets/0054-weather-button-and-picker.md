# 0054: Weather button and picker

**What to build:** The Layer rail gets a Weather button. It opens a small picker with Wind, Temperature, Cloud cover, Rain and Off; exactly one is on, and the choice is remembered on this device. The layers themselves come in 0055 and 0056; this ticket shows a placeholder legend strip for the chosen layer.

**Blocked by:** 0034, 0053

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/weather-layers.md`

**Design:** `docs/design/ui.md` ("Layout" Layer rail); the canvas has no Weather artboard yet, so build from the control kit (`C-Controls`) and add an artboard if time allows.

- [ ] Weather button on the rail with the same on/off brightness as the others; picking Off turns it dim
- [ ] Picking a layer replaces the previous one; never two at once
- [ ] The choice is remembered per device; unreadable storage falls back to Off and does not crash
- [ ] The picker is keyboard-operable and follows the control kit states
- [ ] Vitest: one layer at a time, Off clears, remembered state restored, broken storage falls back
- [ ] All **Commands** pass
