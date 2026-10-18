# God's Eye View design decisions

The visual decisions for the desktop God's Eye View, taken on the design board on 2026-10-18 by the product owner (shared board, final calls by the owner; 55 decided, 0 open). Tickets cite them as `D-NN`. They are final: do not reopen one in a ticket or a review; ask the owner.

Board: https://claude.ai/artifact/4GRPCNjD3JTMvMbKeGVhyg (private; the board's drawing was schematic, not survey data). Spec: `docs/specs/gods-eye-view.md`. Look: `docs/design/ui.md` ("God's Eye View"). The owner's free-text notes, quoted after each decision, are binding requirements.

Where the board's option text adds a detail the one-line choice leaves out, it follows in brackets as "board: …".

## Basemap look

- **D-01** How much do land, water and the border differ? **Lifted land** (board: land two steps up, `surface-panel`; rivers in the lighter `river-300`; border in `ink-400`).
- **D-02** District lines: never, on zoom, or always? **Only past the national zoom** (board: hidden at the national view, faint hairlines once the camera is over the valley).
- **D-03** Which rivers get a name on the map? **Four main rivers + valley** (board: MAHAKALI, KARNALI, GANDAKI, KOSHI along their lines, plus BHOTE KOSHI and TRISHULI).
  Owner: "I see that the river path and such are not actually accurate at all i see the designs we drew up were very basic. lets make sure we update such."
- **D-04** How many place labels at the national zoom? **Capital + valley towns** (board: Kathmandu, Timure, Syabrubesi, Betrawati, Trishuli; cities appear only when zoomed in).
- **D-05** Hillshade strength on the valley walls? **Faint (about 10%)** (board: ridges as a soft darker band either side of the river).
- **D-06** Glow dots, flat dots, or glow only when it matters? **Glow only on Elevated and High** (board: healthy dots flat; the halo is the alarm).
- **D-07** Osiris dark, or lifted for projector washout? **Lifted one step** (board: ground `navy-900`, outside `navy-925`, labels `ink-300`).

## Node marker anatomy

- **D-08** Dot size and glow radius? **Large · 10 px dot, 22 glow** (board: for the six Nodes that matter; the fleet uses the small size).
  Owner: "i want to make sure that the shrinking or clustering at national zoom is smooth and not janky"
- **D-09** Labels always on, or only when zoomed? **Valley + REAL always, fleet on hover or zoom**.
- **D-10** How do REAL Nodes differ from fleet and valley dots? **White ring + REAL tag** (board: one 1.5 px `ink-50` ring outside the dot and REAL under the label).
- **D-11** How do 40 fleet dots avoid clutter at the national zoom? **Shrink to 5 px, no labels** (board: the valley group keeps its size and labels).
- **D-12** How strong is the Elevated and High glow? **Radius grows with level (12 / 16 / 22)**.
- **D-13** The pulse-once when a Node's Flood Risk rises? **Ring + card flash together** (board: the ring on the map and the 600 ms flash on its Node card start on the same frame).

## Contact lost and Stale

- **D-14** The contact-lost cue, from about 5 s to 15 s? **Countdown ring (arc drains)** (board: the glow dies; a grey arc around the dot shrinks from full to empty over the 10 s).
- **D-15** How does a Stale Node look at 15 s? **Grey + struck-through reading** (board: the last water level is struck through to say "do not trust this number").

## Wave front

- **D-16** Head shape of the wave front? **Comet** (board: a bright dot with soft glow and a trail that fades behind it).
- **D-17** How long is the trail behind the head? **Medium, last 15 km**.
- **D-18** How do Nodes light as the front passes them? **Flash once, then settle** (board: the dot goes white for about 2 event minutes, then follows its real state).
- **D-19** Wave colour? **White (ink-50)**.
- **D-20** Ambient flow on the other rivers? **Slow drifting dashes**.
- **D-21** What shows at each town when the wave arrives? **Town label lights + time stamp** (board: the place label turns wave-white and the arrival time, "08:53", appears beside it and stays).

## Warning choreography

- **D-22** Where does the warning band sit, and how tall? **Top, 120 px, countdown inside** (read with D-24 and D-27 below).
- **D-23** Band fill: dashed edge only, a violet tint, or a stripe? **12% violet tint + dashed edge**.
- **D-24** Wave ETA countdown: size and position? **Corner card, 120 px** (board: a fixed card bottom-right beside the Panels; the map stays uncovered; the link to the town is a label).
  Owner: "I dont really like the idea of it over the hometown, but i dont know how i feel about the corner card, I think i am leaning toward the corner card more if we an make it seem more urgent or a critical danger"
- **D-25** How does the countdown escalate as it shrinks? **White, amber under 15, red under 5** (board: "wave expected now" in red).
- **D-26** Camera fly path when the warning fires? **Fly flat, then tilt (1.5 s)** (board: zoom and pan over S0 in 2D, then the pitch eases to the valley angle).
- **D-27** Where does Acknowledge live on the desktop? **In the Alerts Panel only** (board: the band has no button; the card in the Alerts Panel acknowledges; the band stays until then).
- **D-28** What does the "wave started" moment look like? **Origin flashes + ring; band appears** (board: S0 pulses red, the band slides in, the camera starts to fly).
  Owner: "Plus the Chime aswell"
- **D-29** After Acknowledge, what stays on screen? **Chip in the top bar beside Flood Risk** (board: a violet dashed chip "WARNING · 35 MIN" that reopens the card; no banner).

## 3D look

- **D-30** Pitch angle over the valley? **45°**.
- **D-31** Terrain exaggeration? **1.5× (spec)**.
- **D-32** How are the valley walls shaded in 3D? **Height bands (hypsometric tint)** (board: the ground lightens with elevation in two or three steps, so high ground is literally lighter).
- **D-33** How does the national view hand over to the tilted valley? **Tilt only on the camera fly** (board: manual zooming stays flat; only the warning's fly, and a Valley button, tilts).
- **D-34** The 2D / 3D switch: design and place? **Segmented 2D | 3D, bottom-left** (board: a small glass segmented control above the legend). *Owner, 2026-10-18: the switch goes inside the legend box, as its last row; this settles the D-34 / D-39 conflict.*
- **D-35** What shows when terrain drops itself to 2D? **One line in the status strip** (board: "Terrain off · frame rate" in amber mono, nothing else moves).

## Readings Panel for a network (0070)

- **D-36** Which Panel layout? **C · River ladder by River km** (board: valley Nodes in river order on a vertical river line, the wave's position marked between them; REAL Nodes off the river listed under it).
- **D-37** The breadboard Pi's card? **Pinned at the top, "LIVE SENSORS" tag** (board: always first in the Panel with a cyan tag; the valley follows).
- **D-38** A fleet Node opened from the map? **Popover beside the dot** (board: the card floats next to the marker; the Panel is untouched; this is the one exception to "no popups").

## Layer rail, Fleet toggle and legend

- **D-39** Where does the legend live? **Bottom-left, above the 2D / 3D switch** (board: a small glass box beside the rail's foot). *Owner, 2026-10-18: the 2D / 3D switch sits inside this box as its last row.*
- **D-40** How does the Simulated badge read? **40 simulated Nodes · 6 real** (board: numbers instead of adjectives; updates with the registry).
- **D-41** The Fleet toggle: rail button, legend switch, or both? **Rail button with count badge**.
- **D-42** Where do the data sources show? **Hover tooltip on the badge** (board: geoBoundaries (CC BY), OpenStreetMap (ODbL), SRTM, Open-Meteo, with check dates).

## High-ground marker (0068)

- **D-43** Marker shape for a high-ground point? **Chevron-up pin** (board: a rounded triangle with an up arrow, outlined in `ink-50`; cyan outline when the plan points to it).
- **D-44** Wording on the marker? **90 m up · 11 min walk**.
- **D-45** How do high-ground points relate to Shelter pins? **Smaller, shown only when the plan says higher ground** (board: hidden on a calm day; appears, highlighted, with the "No Shelter you can reach in time" plan).

## Rising-water sheet (stretch, 0071)

- **D-46** How does the water level read on the valley walls? **Height line with tick marks** (board: a dashed `river-300` line either side of the river at the level, ticks every metre).
- **D-47** Where does the RECONSTRUCTION label sit? **Both** (board: a label on the water and a status-strip line "Water level: RECONSTRUCTION" beside the Simulated badge).

## Top bar, status strip and Panels

- **D-48** Top bar contents and order? **Logo · Event clock · [Flood Risk] · Online · Hub** (board: the Event clock replaces the Node name on the left; the Node name moves to the status strip).
- **D-49** Status strip contents and order? **Badge first, then freshness, credit right**.
- **D-50** Where do the Evacuation Plan, Cameras and Alerts Panels go? **Readings left; Alerts + Plan right; Cameras third on the right**.
  Owner: "I want readings on the left, Alerts on the right, and plan hidden until an alert is triggered and then we can go with the suggested layout"
- **D-51** How many Panels are open by default, calm vs warning? **Calm: Readings only · Warning: Alerts + Plan**.

## Audience-laptop moment

- **D-52** How does a volunteer's Node dropping and rejoining read from the back of a room? **Ring countdown + CONTACT LOST label + strip note** (board: the marker's cue, the words under its label, and "laptop-pokhara: contact lost 6 s" in the status strip; rejoining fades the dot back in over 300 ms and the strip says "heard again").
  Owner: "plus a small pulse"

## Colour and sound

- **D-53** Does green-for-healthy need a projector adjustment? **Keep green-400** (board: check on the real projector before changing anything).
- **D-54** Amber, red, cyan and violet: keep the roles as today? **As today; the ETA may borrow amber and red**.
- **D-55** The chime's visual pair? **Band border pulses slowly for 3 s** (board: the violet dashed edge pulses twice, in time with the two notes).

## Reading the decisions together

Three places where decisions overlap were read as follows when the spec and tickets were updated (2026-10-18). If the owner meant otherwise, change it here first.

- **One countdown, in the corner card.** D-22 picks a 120 px band whose board text says "countdown inside"; D-24 then puts the Wave ETA countdown in a corner card and D-27 takes Acknowledge off the band. The band is 120 px tall and carries the tag, the warning sentence and the fixed "check official sources" line; the corner card is the only countdown; the band has no button (0066, 0072).
- **The Node name moves to the status strip** (D-48). D-48 does not list the Storm Signal pill or the Household and Node buttons; they keep their places until the owner says otherwise.
- **A fleet Node's popover (D-38) is the one exception** to the "no popups" rule in `ui.md`; valley and real Nodes still open their card in the Readings Panel.
