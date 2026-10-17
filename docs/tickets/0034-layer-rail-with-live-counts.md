# 0034: Layer rail with live counts

**What to build:** A column of buttons on the left edge shows and hides map layers and Panels, each with a live count where one applies. Which Panels are open is remembered on this device, and the starting set depends on the Flood Risk.

**Blocked by:** 0033

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Layout" Layer rail table and Panels); canvas artboards `C-Rail`, `C-Controls`.

- [ ] Buttons for Nodes, Readings, Flood-Prone Areas, Shelters, Route, Storm Signal and Cameras, brightness showing on or off; the Alerts button appears with 0013 and 0014
- [ ] Count badges: Registered Nodes on Nodes, open Shelters on Shelters, live cameras on Cameras
- [ ] A map-layer button hides or shows that layer; a Panel button opens or collapses that Panel
- [ ] At most two Panels are open per side; opening a third collapses the oldest
- [ ] Open Panels are remembered per device in the browser; unreadable storage falls back to the defaults and does not crash
- [ ] Defaults: on a calm day Readings and Evacuation Plan; with a Flood Risk of Elevated or High they stay Evacuation Plan plus whatever Alerts exist
- [ ] Opening a Panel re-centres the map so the selected Node is never hidden
- [ ] Buttons follow the control kit states (hover, pressed, focus-visible, disabled)
- [ ] Vitest tests: counts match the data, the third Panel collapses the oldest, remembered state is restored
- [ ] All **Commands** pass
