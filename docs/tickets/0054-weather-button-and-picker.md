# 0054: Weather button and picker

**What to build:** The Layer rail gets a Weather button. It opens a small picker with Temperature, Cloud cover, Rain and Off; exactly one is on, and the choice is remembered on this device. The layers themselves come in 0055; this ticket shows a placeholder legend strip for the chosen layer.

**Blocked by:** 0033, 0034

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/weather-layers.md`

**Design:** `docs/design/ui.md` ("Layout" Layer rail); the canvas has no Weather artboard yet, so build from the control kit (`C-Controls`) and add an artboard if time allows.

- [ ] Weather button on the rail with the same on/off brightness as the others; picking Off turns it dim
- [ ] Four choices: Temperature, Cloud cover, Rain, Off (no Wind; it was dropped on 2026-10-18)
- [ ] Picking a layer replaces the previous one; never two at once
- [ ] The choice is remembered per device; unreadable storage, or a stored choice that no longer exists (an old `Wind`), falls back to Off and does not crash
- [ ] The rail and picker sit on the MapLibre map from 0033 (the Leaflet map is gone)
- [ ] The picker is keyboard-operable and follows the control kit states
- [ ] Vitest: one layer at a time, Off clears, remembered state restored, broken storage and a stored `Wind` fall back to Off
- [ ] All **Commands** pass
