# 0036: Phone layout

**What to build:** On a screen under 900 px the dashboard becomes four bottom tabs (Map, Readings, Alerts, Plan) with 44 px touch targets. A resident on the Node Wi-Fi opens the Map tab, taps a Node to peek at it in a bottom sheet, and finds their Household Profile, Evacuation Plan and Route on the Plan tab.

**Blocked by:** 0033

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Phone"); canvas artboards `P-Map-Calm`, `P-Map-Selected`, `P-Map-Storm`, `P-Readings`, `P-Plan-Calm`, `P-Plan-Storm`, `P-Plan-NoProfile`, `P-Plan-NoShelter`, `P-Plan-NoRoute`, `P-Plan-NoCachePack`, `P-Route`, `P-Profile-Empty`, `P-Profile-Picking`, `P-Profile-Saved`.

- [x] Under 900 px: the top bar keeps only the logo, the Flood Risk chip and the connection pill; a bottom tab bar switches between Map, Readings, Alerts and Plan
- [x] Map tab: the map, the risk chip and a bottom sheet that peeks at the selected Node; the pinned latest Alert arrives with 0013 and 0014
- [x] Readings tab: the Node cards, then the Cameras
- [x] Plan tab: Household Profile first, then the Evacuation Plan, then the Route, in all six Plan states drawn on the canvas
- [x] Every control is at least 44 px; Panels use a near-opaque surface with no blur
- [x] From 900 px up the desktop layout is unchanged; tablets show one Panel open per side
- [x] The Alerts tab shows an empty state until 0013 and 0014 fill it
- [x] Vitest flow tests at a phone width: each tab shows its content, selecting a Node opens the sheet
- [ ] Manual check: on a phone over Tailscale, all four tabs work (rehearsal, not a Pi check)
- [x] All **Commands** pass
