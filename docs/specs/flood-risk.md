# Flood Risk and Storm Signal

**Status:** ready-for-agent

Ticket: `docs/tickets/0006-flood-risk-and-storm-signal.md`. Parent spec: `docs/specs/storm-shield.md`. Formats: `docs/specs/wire-formats.md`. Look: `docs/design/ui.md`. Words follow `CONTEXT.md`.

## Problem Statement

A resident can see Community Readings (pressure, rain rate, water level, soil moisture) for each Node, but nothing turns those numbers into an answer. They have to work out for themselves whether the water is rising, whether it is raining and whether a storm is coming. Worse, a dashboard that always shows a risk level, even "Low" on a sunny day, teaches people to ignore it. And if it simply says "High" with no explanation, nobody can check it against what they see outside.

## Solution

Every Node works out Flood Risk from the Community Readings it holds and shows it with the reasons behind it, such as "water level 650 cm at 1 Node". In calm weather nothing is shown at all. Low appears only when it is raining or a Storm Signal is on, and Elevated and High follow from water level, rain rate and a rising trend. When air pressure is low across the Nodes, a Storm Signal badge appears on the map. Stepping the Scenario visibly moves the dashboard from nothing, to Low with the Storm Signal, to Elevated, to High. Every Node computes this itself, so the answer survives the Hub going down.

## User Stories

1. As a resident, I want to see nothing about Flood Risk on a calm day, so that when it does appear I take it seriously.
2. As a resident, I want Flood Risk to appear as Low when it is raining, so that I know the weather has turned even though no danger is near.
3. As a resident, I want Flood Risk to appear as Low when a Storm Signal is on, so that a storm approaching is not hidden just because no rain has fallen yet.
4. As a resident, I want Flood Risk to be Elevated when the water is up, the rain is heavy or the water is rising, so that I notice the situation getting worse.
5. As a resident, I want Flood Risk to be High when the water is very high, or when heavy rain meets rising water, so that I know the danger is real.
6. As a resident, I want a creek that is still high after the rain stops to keep showing Elevated, so that a quiet sky does not hide a flooded street.
7. As a resident, I want every Flood Risk level to list its reasons with counts and current values, so that I can check the reasoning against what I see outside.
8. As a resident, I want the reasons to say how many Nodes agree, so that I can tell a neighborhood-wide problem from one Node's reading.
9. As a resident, I want the headline to be the worst level any Node reports, so that I see the nearest danger and not an average that dilutes it.
10. As a resident, I want "raining" to need two Nodes seeing soil moisture rise, so that one odd sensor cannot make the dashboard say it is raining.
11. As a resident, I want a Node that is the only one reporting to be believed on its own, so that a small Mesh (or my Node when the others are down) still works.
12. As a resident, I want a Storm Signal badge on the map when pressure is low across Nodes, so that I notice a storm's approach.
13. As a resident, I want the Storm Signal to need half or more of the Nodes to agree, so that one faulty barometer cannot raise it.
14. As a resident, I want the Storm Signal to stay on while pressure stays low, so that it does not blink off two minutes after the pressure first drops.
15. As a resident, I want the Storm Signal to show the lowest pressure and how many Nodes see it, so that I understand it.
16. As a resident, I want the Storm Signal separate from Flood Risk, so that "a storm is coming" and "water is rising" are never confused.
17. As a resident, I want each Node's map dot colored by that Node's own level, with the word as well as the color, so that I can see where the water is worst.
18. As a resident, I want Low never to color an individual dot, so that a dot is neutral until its own readings are a concern.
19. As a resident, I want the level shown in the top bar with its word, so that I can read it at a glance on a phone.
20. As a resident, I want the Flood Risk card to disappear when there is nothing to show, so that the page is not cluttered with "no risk".
21. As a resident, I want the Flood Risk to update on its own while I watch, so that I do not refresh the page.
22. As a resident, I want the reasons written as plain sentences, so that I do not need to decode reason codes.
23. As a resident, I want the Flood Risk to keep working with no internet, so that it does not fail when the storm cuts the lines.
24. As a Sensor Node operator, I want my Node to compute Flood Risk from what it sees, so that my household keeps seeing risk rising if the Hub goes down.
25. As a Sensor Node operator, I want a restarted Node to behave sensibly while its history refills, so that a restart never shows a false "rising".
26. As a demo presenter, I want the Scenario's first step to show no Flood Risk, so that the demo opens calmly.
27. As a demo presenter, I want the pressure-drop button to raise the Storm Signal and show Low, so that the storm's approach lands on cue.
28. As a demo presenter, I want the rain step to show Elevated, and the water-rising step to show High, so that the climax is visible from across the room.
29. As a demo presenter, I want resetting the Scenario to return the dashboard to showing nothing, so that I can run the demo again.
30. As the Hub operator, I want each Node's own level available from the Node's API, so that the Hub can later count Nodes at High before issuing a Community Warning.
31. As a developer, I want every threshold in one place with a name, so that I can tune them after seeing real readings.
32. As a developer, I want the Flood Risk rules to be a pure function of readings and the current time, so that I can test each rule without a running Mesh.
33. As a developer, I want tests to move time forward without waiting, so that "rising over two minutes" is tested in milliseconds.

## Implementation Decisions

- **Flood Risk module.** One pure function takes the recent readings of every counted Node (about two minutes of history each) and the current time, and returns the headline level (or none), the reasons, each Node's own level, and the Storm Signal. It has no knowledge of the Mesh, the clock or HTTP.
- **Thresholds module.** Every number lives in one named place: water 300 cm (Elevated) and 600 cm (High), tuned for a mountain river (the 6 m is the reported Syabrubesi warning level; ticket 0062); rain rate 10 mm/h (Elevated) and 25 mm/h with rising water (High); "water rising" is a 50 cm rise; a Surge is a 300 cm rise within 60 s of the sender's own timestamps, High at once (ticket 0046); "soil rising" is a 3-point rise; the history window is 2 minutes; the Storm Signal is pressure below 1000 hPa at half or more of counted Nodes. They are a first pass and are meant to be retuned.
- **History in the reading store.** The store keeps, per Node, the readings received in the last 2 minutes, in memory only, timestamped on this Node's own clock (as `age_s` already is). It still answers "latest reading per Node". "Rising" means the newest value minus the oldest value still in the window; a Node with a single reading has no trend and is not rising. A restarted Node starts with an empty history, so nothing is rising until a second reading arrives.
- **Which Nodes count.** A single check, "does this Node count?", decides. For now every Node the store holds counts. Registered-only (0012) and the 60-second silence cutoff (0021) will tighten this one check without touching the rules.
- **Per-Node level.** Elevated or High (or none), from that Node's own water level, rain rate and rising water. Low is deliberately not a per-Node level, because "raining" is judged across the Mesh.
- **Raining.** Soil moisture rising at two or more counted Nodes; with fewer than two counted Nodes, at the one that counts. This stands in for rain because Nodes have no humidity sensor; the rain-rate rules still use the rain-rate reading.
- **Storm Signal.** On while pressure is below the threshold at half or more of the counted Nodes (at least one). It is computed from current values, not a trend, so it holds steady and survives a restart.
- **Headline.** The highest per-Node level. If no Node is Elevated or High but it is Raining or the Storm Signal is on, the headline is Low. Otherwise there is none.
- **Reasons.** One entry per rule that fired, naming the reason code, how many Nodes triggered it and the most telling value among them. Codes are the five from the wire format (`water_surge`, `water_high`, `water_rising`, `rain_heavy`, `pressure_falling`) plus `raining` for rising soil moisture, which only ever appears in the API and never in a Community Warning. Water at 30 cm or more uses `water_high`; the level (Elevated or High) comes from the threshold crossed. There is no duration wording. The dashboard writes the sentences, so wording can change without touching the Node.
- **Node API.** A new endpoint returns the Flood Risk snapshot:
  - `level`: `"low"`, `"elevated"`, `"high"` or `null`;
  - `surged`: the ids of the Nodes whose water is surging now (ticket 0046);
  - `reasons`: a list of `{code, nodes, value}` (`water_surge` also carries `seconds`, how long the rise took, the one reason that states a duration), empty when `level` is `null` (a Storm Signal with no other reason still gives `pressure_falling`);
  - `storm_signal`: `{on, nodes, pressure_hpa}`, where `pressure_hpa` is the lowest current value;
  - `nodes`: each counted Node id mapped to its own level (`"elevated"`, `"high"` or `null`).
  Ticket 0019 folds this into `/api/state` as a block with the same shape. The wire format is unchanged: Flood Risk is never sent over the Mesh.
- **Injectable clock.** The Node takes a clock for "now" instead of reading the system time directly, defaulting to the real one. The meshed-Nodes test harness passes one through, so a test can advance time. This is a testing mechanism, not a new seam.
- **Dashboard data.** The dashboard polls the Flood Risk endpoint about once a second, like the one-snapshot polling the wire-format notes describe, and shows it next to the readings.
- **Dashboard: top bar and card.** A top-bar chip shows the level and its word (Low green, Elevated amber, High red, never color alone), and a Flood Risk card heads the Readings rail with the reason sentences. Both are absent when `level` is `null`. If the design canvas has a different slot for the card, follow the canvas.
- **Dashboard: Storm Signal.** A badge on the map shows "Low pressure: N hPa at K Nodes". When the Storm Signal is the only reason for Low, the card repeats it.
- **Dashboard: map dots.** The dots from 0005 are colored by the Node's own level (Elevated amber, High red) and show the word; a Node with no level keeps the neutral Community color. This finishes the "Flood Risk coloring arrives with 0006" note in the 0005 spec.
- **Reason sentences.** A small pure mapping turns `{code, nodes, value}` into a sentence ("water level 650 cm at 1 Node", "heavy rain: 30 mm/h at 2 Nodes", "low pressure: 1002 hPa at 3 Nodes", "soil moisture rising at 2 Nodes", "water level rising at 2 Nodes", "water rose 3.2 m in 8 s"; the card leaves out "rising" while a Surge says it), with singular and plural handled.
- **Glossary.** `CONTEXT.md` already gained Storm Signal and Raining and the revised Flood Risk. No ADR.

## Testing Decisions

- A good test drives the system through a seam and checks what a resident or operator would see: the level, the reasons, the Storm Signal and what the page shows. It does not reach into the store, the thresholds module or call counts. Test names use the glossary's words.
- **Seam A: Node HTTP API with the in-memory Mesh (pytest).** All rules are tested here, by stepping the Scenario and running meshed Nodes with an advancing clock. Cases:
  - a calm day (normal day step): `level` is `null`, no reasons, Storm Signal off;
  - the pressure-drop step: Storm Signal on and `level` is `"low"`, with a `pressure_falling` reason;
  - the rain step: `level` is `"elevated"`, reasons include rain and water;
  - the water-rising step: `level` is `"high"`, with `water_high` and `rain_heavy`;
  - resetting returns to `null`;
  - soil moisture rising at two Nodes gives Low; at only one of two Nodes it does not;
  - a lone Node's own soil moisture rise gives Low;
  - Storm Signal needs half or more of the Nodes below the pressure threshold; one low barometer among several does not raise it;
  - water that stays high after the rain stops stays Elevated once soil moisture has stopped rising;
  - after two minutes without a further rise, "rising" and Low-from-rain fade, while a still-low pressure keeps the Storm Signal on;
  - the headline is the worst Node's level, and `nodes` reports each Node's own level;
  - a freshly restarted Node does not report anything as rising from a single reading.
  Prior art: the shared-readings and Node API tests and the `MeshedNodes` harness.
- **Dashboard seam (Vitest + Testing Library).** Checked through the rendered page with fixtures for the polled Flood Risk: the card and top-bar chip are absent when `level` is `null`; they show the level word and the reason sentences otherwise (including singular and plural); the Storm Signal badge appears with its pressure text; a Node's dot or card shows its own level word. Prior art: the existing dashboard `App` tests. The Leaflet map is not rendered in jsdom, so the dot colors and the badge on the map are checked once by running the app and stepping the Scenario, as 0005 did.
- Rule arithmetic is not re-tested in the dashboard. The dashboard tests only check that what the API returns is shown.

## Out of Scope

Registered-only counting and Unverified greying (0012), the 60-second silence cutoff and dropping silent Nodes (0021), the Community Warning and its two-Nodes-High rule (0013), the Evacuation Plan reading Flood Risk (0009), `/api/state` and the polling replacement of the readings stream (0019), a real humidity sensor, persistent history across restarts, calibration against real creek data, and official-alert influence on Flood Risk.

## Further Notes

- **Soil moisture as rain.** The Scenario's rain step raises soil moisture by 23 points, so the demo shows Low then Elevated. Real soil moisture rises slowly and falls slowly, so Low-from-rain will fade about two minutes after soil stops rising; Elevated holds if water stays at 300 cm or more.
- **Silent Nodes count until 0021.** Until the cutoff exists, a Node that goes quiet keeps its last reading in every calculation.
- **Evacuation Plan and Community Warning must accept `null`.** Tickets 0009 and 0013 read the level, which can now be absent.
- **Calm-day quirk.** A Node at 300 cm or more of water on a dry, high-pressure day still shows Elevated, on purpose.
- The reason code `pressure_falling` is kept from the wire format even though the rule tests for low pressure, not for a fall; the sentence says "low pressure".
