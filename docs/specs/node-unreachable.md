# Dashboard shows Node unreachable

**Status:** ready-for-agent

Ticket: `docs/tickets/0042-node-unreachable.md`. Parent spec: `docs/specs/state-snapshot.md`, whose "Node unreachable" parts this spec replaces. Formats: `docs/specs/wire-formats.md` ("Node HTTP API"). Words follow `CONTEXT.md`.

## Problem Statement

A Viewer's phone reads everything live from one Node. When that Node stops answering (the Node is unplugged, the phone walks out of Wi-Fi range, the Wi-Fi itself drops), the dashboard keeps showing the last readings, Flood Risk, online status, camera pictures and Event clock as if they were current. During a flash flood a frozen water level is the worst thing the screen can show: it looks calm while the river rises.

The opposite failure matters too. A Wi-Fi hiccup of a second or two is normal on a phone, and a warning that flashes on every blip teaches the resident to ignore it. And when the Node is gone, the resident still needs what is already on the phone, the map, the Shelters and their Household Profile, to decide where to go.

Today, a single failed poll of the open-Shelter list also empties it, so one hiccup removes every Shelter from the Evacuation Plan.

## Solution

When the dashboard has had no good answer from its Node for 5 seconds, it shows **Node unreachable**: a banner under the header that says live readings are hidden until the Node answers again, and that the map, Shelters and the Household Profile are still there. A page that has never reached its Node shows "Connecting…" for those 5 seconds, then the same warning.

While unreachable, everything live from the Node is cleared: readings, Flood Risk, the Online / Mesh-only badge, camera tiles and the Event clock. Cameras and the Event clock stop asking. What helps the resident plan stays: the map, the Cache Pack's content, the Household Profile, the Node's name and role, the last Official Alerts, and the last open-Shelter list, with a line in the Evacuation Plan saying how long ago Shelter status was last confirmed, because nothing can check it now. On a Hub, the Replay controls say they are waiting for the Hub instead of offering a Start button.

The first good answer clears the warning and brings everything back.

## User Stories

1. As a resident, I want to be told "Node unreachable" when my phone cannot reach its Node, so that I do not trust numbers that stopped updating.
2. As a resident, I want live readings to disappear while my Node is unreachable, so that a frozen water level is never mistaken for a current one.
3. As a resident, I want Flood Risk to disappear while my Node is unreachable, so that an old "Low" never reassures me while the river rises.
4. As a resident, I want the Online / Mesh-only badge to disappear while my Node is unreachable, so that I am not told my Node is online when I cannot reach it at all.
5. As a resident, I want camera tiles to disappear while my Node is unreachable, so that an old picture is never taken for a live one.
6. As a resident watching the replay, I want the Event clock to disappear while my Node is unreachable, so that a stopped clock never looks like a calm moment in the flood.
7. As a resident, I want a Wi-Fi hiccup of a few seconds not to flash a warning, so that the warning means something when it appears.
8. As a resident, I want the warning to appear within about 5 seconds of my Node going quiet, so that I am not left trusting the screen for long.
9. As a resident opening the dashboard, I want "Connecting…" while the page first tries its Node, so that I am not told it is unreachable before it has tried.
10. As a resident opening the dashboard on a dead Node, I want "Node unreachable" after 5 seconds instead of "Connecting…" forever, so that I know to move closer or try another way.
11. As a resident, I want the warning gone the moment my Node answers again, so that I am not left staring at a banner that is no longer true.
12. As a resident, I want readings, Flood Risk, status, camera tiles and the Event clock back on the first good answer, so that I do not have to reload the page.
13. As a resident, I want the map to stay while my Node is unreachable, so that I can still see the river corridor and my home.
14. As a resident, I want the Shelters from the Cache Pack to stay while my Node is unreachable, so that I can still see where to go.
15. As a resident, I want my Household Profile to stay while my Node is unreachable, so that my Evacuation Plan still fits my household.
16. As a resident, I want the last known open Shelters to stay while my Node is unreachable, so that my plan still points me somewhere.
17. As a resident, I want to be told how long ago Shelter status was last confirmed while my Node is unreachable, so that I know a Shelter may have closed since.
18. As a resident, I want one failed check of the Shelter list not to empty it, so that a hiccup never leaves my plan with nowhere to go.
19. As a resident, I want the last Official Alerts to stay while my Node is unreachable, so that an evacuation order does not vanish because of a Wi-Fi drop.
20. As a resident, I want the banner to say what is still there, so that I know the map and plan are safe to use.
21. As a resident, I want the Node's name to stay in the header while unreachable, so that I know which Node I have lost.
22. As a Hub operator, I want the Hub Panel to stay open if my Hub stops answering, so that I do not lose my place mid-demo.
23. As a Hub operator, I want the Replay controls to say they are waiting for the Hub instead of showing Start, so that I am not invited to restart a replay that is already running.
24. As a Hub operator, I want the Replay controls back with the right buttons on the Hub's first answer, so that I can carry on the demo.
25. As a resident, I want camera pictures not to be fetched while my Node is unreachable, so that my phone does not keep asking a Node that cannot answer.
26. As a presenter, I want "pull the plug, count to five" to show the warning every time, so that the offline part of the demo is predictable.
27. As a teammate, I want one rule for when the dashboard counts its Node as unreachable, so that every panel agrees about it.
28. As a resident, I want my Household Profile never to be sent while the dashboard retries its Node, so that polling never reveals my home.

## Implementation Decisions

- **One rule, in time.** `connection` is `connecting` until the first good answer, `connected` after one, and `unreachable` once 5 s have passed with no good answer, counted from the last good answer or, before any, from when polling started. It runs on its own 5 s timer, restarted by each good answer, so a Node that answers with errors and one that hangs (its requests given up on after 2 s) are both caught at 5 s, from the start or after a good answer. This replaces the "3 failed polls in a row" rule in the parent spec. A good answer is an OK `/api/state` response; a network error, a non-OK answer and the 2 s request timeout are not. Any good answer returns to `connected` at once.
- **The poll itself does not change.** `/api/state` is still polled every second with a chained timeout and a 2 s request timeout, and `refresh()` still polls at once. The state hook decides `connection`; it is the only place the 5 s rule lives.
- **Unreachable drops the live state.** While unreachable, the hook hands back no readings, Flood Risk or online status, so no panel can show a frozen one. It keeps the Node's last known `name`, `role` and Official Alerts, so the header still names the Node, the Hub button and Hub Panel stay on a Hub, and Official Alerts with their Evacuation Plan lines stay.
- **The banner.** While unreachable, a banner with the `alert` role under the header reads: "Node unreachable. Live readings are hidden until it answers again; the map, Shelters and your household profile are still here." The Online / Mesh-only badge is not shown. "Connecting…" shows only while `connecting`.
- **Cameras and the Event clock follow the connection.** Their polls stop while unreachable and drop their last answer, so no tile or clock is shown, and start again on the first good answer. The shared interval poller learns to be stopped this way; its other users are unaffected.
- **Replay controls.** Until the Event clock has been heard (on first load, and again after unreachable, since its last answer is dropped), the Hub Panel's Replay section shows "Waiting for the Hub to answer" and no buttons, so Start is never offered for a replay that may be running. Once the clock answers it shows the controls as usual.
- **Open-Shelter list.** A failed poll keeps the last list. Before the list's first answer nothing counts as open, as today. Its poll keeps running while unreachable, so the list updates on the first answer.
- **Shelter line in the Evacuation Plan.** While unreachable, the plan adds "Shelter status last confirmed N s ago; it may have changed since", counting from the last good `/api/state` answer, ticking each second, and reading minutes past 90 s as Stale ages do. It is gone when the Node answers.
- **Kept untouched:** the map, Cache Pack content, the Household Profile, the Scenario step and reset buttons and their keys (a failed POST is logged; the next good answer shows the truth).
- **Glossary.** `CONTEXT.md` defines **Node unreachable**: the Viewer's link to its own Node, distinct from Mesh-only and Stale; live readings, Flood Risk, online status and camera pictures are not shown, and what is on the Viewer's device stays.
- **Docs.** The parent spec's "Polling rules", "While unreachable" and the 3-failure note point here. The "Node HTTP API" section of `docs/specs/wire-formats.md` already describes `/api/state` as built and the removed endpoints; it gains "after 5 s with no good answer" where it says the dashboard shows "Node unreachable". The group chat is told, because that file says changes need the whole team.
- **No ADR.** Every decision here is cheap to reverse.

## Testing Decisions

- **A good test** checks what the resident sees on screen and which requests the page makes, not which hook made them.
- **One seam: the dashboard Vitest seam.** `App` renders against a stubbed `fetch` for `/api/state`, `/api/cameras`, `/api/replay` and `/api/shelters`, with fake timers advancing the chained poll. No Node (pytest) changes.
- Cases:
  - a Node that stops answering (network error, non-OK answer, or a request that hangs past the 2 s timeout) leaves the screen unchanged at 4 s and shows "Node unreachable" at 5 s;
  - a page whose Node never answers shows "Connecting…", then "Node unreachable" after 5 s;
  - failures broken by a good answer never add up to the warning;
  - while unreachable: no readings, Flood Risk, status badge, camera tile or Event clock; the map, the Household Profile, the Node's name, the Official Alerts and the open Shelters stay;
  - camera and Event clock requests stop while unreachable and resume after;
  - the Shelter line appears while unreachable and its age grows;
  - on a Hub, the Replay section shows "Waiting for the Hub to answer" and no Start button while unreachable, and its controls on the next good answer;
  - the next good answer clears the banner and the Shelter line and restores the data;
  - one failed `/api/shelters` poll keeps the open list.
- **Privacy (0008).** "No request carries the Household Profile" already runs several real poll cycles; it also runs across an unreachable stretch, so retries carry no profile either.
- **Prior art.** `nodeStatePolling.test.tsx` (chained poll, hung requests, fake timers), `onlineStatusFlow.test.tsx` (badge and camera tiles), `householdFlow.test.tsx` (privacy), `hubPanelFlow.test.tsx` and `replayControlsFlow.test.tsx` (Hub Panel), and the shared `fakeNodeState` helper.
- **Not tested.** Real Wi-Fi drops on a phone. Rehearsed locally: stop the Node process and watch the dashboard on a phone over Tailscale; say so in the report, and that real Wi-Fi is unproven.

## Out of Scope

- Asking another Node, or the Hub directly, when the Viewer's own Node is unreachable.
- Checking Shelter status while unreachable; the plan only says how old it is.
- Hiding or disabling the Scenario buttons, or the Hub Panel's Shelter controls, while unreachable.
- Changing the 1 s poll or the 2 s request timeout, or any push channel.
- The new dashboard design (0032 to 0039); the banner is restyled there.
- Folding Shelters, cameras or the Event clock into `/api/state`.

## Further Notes

- The parent spec chose 3 failures, about 3 s; this spec moves to 5 s so a reconnect has time to succeed before the resident is warned.- Official Alerts stay because each carries its own issue time and losing an evacuation order to a Wi-Fi drop is worse than an alert seconds old. Readings and Flood Risk carry no such promise.
