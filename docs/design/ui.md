# Dashboard UI design

How the Storm Shield dashboard looks and where things go. **The visual source of truth is the design canvas: https://claude.ai/artifact/722U2tKJ78hvbbbNUnx2dQ** (foundations, one artboard per view, shared components). Build from it; if a view is missing, add an artboard there first. Message and API shapes: `docs/specs/wire-formats.md`. Spec: `docs/specs/storm-shield.md`. Words follow `CONTEXT.md`.

## Reference

The look is borrowed from [Osiris](https://github.com/carbon-evolution/osiris) ([osirisai.live](https://osirisai.live)), an open-source OSINT dashboard that layers cameras, weather and satellite data on one map.

What we take from it:

- **The map is the page.** Everything else sits around or floats over it.
- **A rail with live counts** beside the map.
- **Translucent glass panels** over the map, with pulse dots for live status.
- **Freshness badges** and an **OFFLINE** state when a source is down.
- **A dark "ops room" theme**, all colors from CSS variables. (Osiris defaults to light; we chose dark, below.)

What we leave out: the 40 layers, globe, AI analyst, finance, cyber. Storm Shield has one neighborhood and one storm.

## Which views get built

| Group | Views |
|---|---|
| **Must build (on stage)** | Resident Normal day, Resident Storm, Resident Mesh only, Phone Home, Phone Evacuation Plan, Phone Route, Warning Takeover |
| **Simple but real (setup, not shown)** | Phone Household Profile, Hub Panel (registry, warning log, Shelters, live/replay) |
| **Stretch** | Sensor Node on-screen Scenario stepper (the breadboard drives the demo), "Mark road blocked" / "Find another route" (0018), QR code to join the dashboard |

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Storm Shield  porch · Hub   [Hub]   ● Mesh only   Flood: LOW │  top bar
├──────────────────────────────────────────────────────────────┤
│ persistent banner for an acknowledged warning (when active)  │
├────────┬─────────────────────────────────────┬───────────────┤
│Readings│                                     │ Alerts        │
│  rail  │              MAP                    ├───────────────┤
│        │   Node dots with water level,       │ Evacuation    │
│        │   storm signal, route, cameras      │ Plan          │
│        │                                     ├───────────────┤
│        │                                     │ Cameras       │
├────────┴─────────────────────────────────────┴───────────────┤
│ freshness badges · OFFLINE note                              │  status strip
└──────────────────────────────────────────────────────────────┘
```

- **Phone:** four bottom tabs (Map, Readings, Alerts, Plan), 44 px minimum touch targets. Residents open the dashboard on a phone first.
- **Map Nodes:** each dot shows the Node name and its water level, colored by that Node's Flood Risk. Selecting a Node highlights its card in the Readings rail and the other way round. No popups.
- **Evacuation Plan on a device with no Household Profile** (the projected Hub laptop): a hand-off card, "Your plan lives on your phone", with this Node's address. The full plan appears on any device that has a profile.
- **Hub Panel:** a "Hub" button in the top bar, present only when the Node's role is Hub, opens a slide-over with tabs for the registry and for the warning log, Shelter status and live/replay switch. The map keeps updating underneath.

## Warning Takeover

Any new Official Alert or Community Warning takes over the screen. It is the only thing allowed to overpower the layout.

- Full-screen modal with one large acknowledge button.
- Official and Community keep their own treatment inside the same frame: Official on the light panel with the solid blue OFFICIAL tag; Community with the violet dashed edge, COMMUNITY WARNING · NOT OFFICIAL, and the fixed "check official sources for any evacuation decision" line.
- If both are pending, Official shows first, then Community ("1 of 2").
- Acknowledgement is per device and stored in that browser, keyed by the warning's id. A new warning opens the takeover again; the same one does not.
- After acknowledging, a banner stays under the top bar and the card stays in the Alerts column. A warning never silently disappears.
- One short two-note chime when the takeover opens, on any device whose page has been tapped once (browsers block sound before that). It never loops. The border pulses slowly; never a strobe. With reduced motion on, no pulse.

## Visual language

| Thing | Rule |
|---|---|
| Theme | Dark. Colors only through the CSS variables in `dashboard/src/App.css` (names match the canvas: `--bg`, `--surface`, `--surface-2`, `--line`, `--text`, `--muted`, `--community`, `--low`, `--elevated`, `--high`, `--official`, `--official-ink`, `--official-blue`, `--warning`) |
| Contrast | At least 7:1 for all text on its background. Greyed-out Unverified Nodes are the only deliberate exception, and stay at least 4.5:1 |
| Scale | Projector-first on desktop: everything at 120% (body about 18 px, tags about 14 px), with the side columns narrowed so the map keeps its share. The map stays the biggest thing on screen. Phones use the base scale |
| Map tiles | Dark tiles from the Cache Pack, with the data credit always shown |
| Panels | Translucent surface, 1 px border, backdrop blur, 8 px radius |
| Type | IBM Plex Sans for text; IBM Plex Mono for labels, tags and numbers |
| Flood Risk | Low green, Elevated amber, High red; always with the word, never color alone |
| Official Alerts | Light panel, solid blue OFFICIAL tag, OFFICIAL · REPLAY for replays, link to the source |
| Community information | Cyan accents; Community Warnings have a violet dashed edge. Never the official style |
| Simulated Readings | Always carry a SIMULATED tag |
| Unverified Nodes | Greyed out, NOT COUNTED tag |
| Stale | After 15 s: greyed with STALE and the age. Camera tiles say OFFLINE when the internet is down, never show a frozen frame |
