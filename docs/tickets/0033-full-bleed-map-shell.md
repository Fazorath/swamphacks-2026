# 0033: Full-bleed map shell

**What to build:** On a desktop the map fills the screen under a new top bar and above a status strip, and the existing Readings, Evacuation Plan and Cameras Panels float over it as translucent glass. Each Panel can be collapsed with a chevron. The page reads as the map first, with everything else laid over it.

**Blocked by:** 0032

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Layout", "Alerts Panel" excluded); canvas artboards `C-TopBar`, `C-StatusStrip`, `C-Panel`, `D-Normal`.

- [ ] The map fills the viewport between the top bar and the status strip; Panels are positioned over it (Readings docks left at 288 px, Evacuation Plan and Cameras stack right at 336 px, sizes before the 120% scale)
- [ ] Top bar: logo, Node name and role, Flood Risk chip, Storm Signal pill when on, Online / Mesh-only pill, Household button, Hub button only on a Hub
- [ ] Status strip: age of the readings, Cache Pack version, cameras live or offline; says Mesh-only when it is
- [ ] Panels use the glass surface with a blur on desktop only; each has a collapse chevron and opens with the 180 ms slide
- [ ] The Household and Hub slide-overs keep working over the new shell
- [ ] The Alerts placeholder stays out of the layout until 0013 and 0014 bring the real Alerts Panel
- [ ] Vitest flow tests: the Hub button is absent on a Sensor Node; collapsing a Panel hides its content
- [ ] Manual check: a 1440 × 900 screen shows about 40% clear map with one Panel open per side
- [ ] Animates only `transform` and `opacity`; a poll that changes nothing re-renders nothing
- [ ] All **Commands** pass
