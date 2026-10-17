# Shelter status updates

**Status:** ready-for-agent

Ticket: `docs/tickets/0015-shelter-status-updates.md`. Parent spec: `docs/specs/storm-shield.md`. Formats: `docs/specs/wire-formats.md` (Shelter status). Look: `docs/design/ui.md`. Words follow `CONTEXT.md`.

## Problem Statement

The Cache Pack says where every Shelter is, but not which ones the county has actually opened. Today every Node pretends all of them are open, so a resident's Evacuation Plan can send them to a building that is closed or full. When the county closes a Shelter mid-storm, the internet is likely down, the Cache Pack cannot be downloaded again, and a resident without a map app has no way to learn it.

## Solution

The Hub operator marks each Shelter open or closed from the Hub's dashboard. The Hub announces the full Shelter status over the Mesh, signed with its identity, and repeats it every 30 seconds so late joiners and Nodes that missed a packet catch up. Every Node keeps the latest announcement and lays it over the Cache Pack: the dashboard and the Evacuation Plan show and use only Shelters the Hub has announced as open. If a resident's nearest Shelter closes, the plan switches to the next one, with no internet and no new download. Nothing counts as open until the Hub has said so.

## User Stories

1. As the Hub operator, I want to open or close a Shelter with one tap in the Hub Panel, so that I can pass on a county announcement in seconds.
2. As the Hub operator, I want the Hub Panel to list every Shelter from the Cache Pack with its current status, so that I can see what residents see.
3. As the Hub operator, I want the Hub button to appear only on the Hub, so that a Sensor Node's dashboard cannot suggest it can change Shelter status.
4. As the Hub operator, I want my change to show on the Hub's own dashboard immediately, so that I know the tap worked.
5. As the Hub operator, I want the Hub to announce the change over the Mesh right away, so that residents do not wait for the next repeat.
6. As the Hub operator, I want the Hub to repeat the full Shelter status every 30 seconds, so that a Node that missed a packet or just joined catches up on its own.
7. As the Hub operator, I want the Hub to start with every Shelter in its Cache Pack open, so that the demo works without setup and I only close a Shelter to show rerouting.
8. As the Hub operator, I want the Hub to remember Shelter status across a restart, so that a restart does not reopen a Shelter I closed.
9. As the Hub operator, I want the Hub's version number never to go backwards after a restart, so that Nodes do not ignore the Hub's announcements as old.
10. As the Hub operator, I want an unknown Shelter id to be refused with a clear error, so that a typo cannot announce a Shelter that does not exist.
11. As the Hub operator, I want the Hub to refuse to change Shelter status until it holds a valid Cache Pack, so that it never announces Shelters it cannot name.
12. As a resident, I want my Evacuation Plan to switch to the next nearest Shelter when mine closes, so that I never drive to a closed building.
13. As a resident, I want the plan to say "No open Shelter announced yet. Follow official sources." and draw no route when none is open, so that I am never sent anywhere on a guess.
14. As a resident, I want a Shelter to count as open only after the Hub has announced it, so that a Node that has heard nothing never invents good news.
15. As a resident on a Sensor Node that just started, I want the dashboard to wait for the Hub's next announcement instead of showing every Shelter open, so that I am not briefly sent to a Shelter the Hub has closed.
16. As a resident, I want my Node to keep the last Shelter status it heard if the Hub goes quiet, so that my plan does not collapse the moment the Hub's Wi-Fi drops.
17. As a resident, I want Shelters the Hub has closed to show as closed on the map and in the list, so that I can tell closed from open at a glance.
18. As a resident, I want Shelter status to update on its own while I watch, so that I do not refresh the page.
19. As a resident, I want Shelter status to keep working with no internet, so that it does not fail when the storm cuts the lines.
20. As a resident, I want the Shelter status to come only from the Hub, so that nobody else on the Mesh can close a Shelter on me.
21. As a resident, I want a Shelter that was open in the last announcement but is missing from the latest one to show as closed, so that closing a Shelter takes effect.
22. As a Sensor Node operator, I want my Node to accept an older-looking announcement only if it is newer than what it holds, so that a repeated or relayed old copy cannot undo a closure.
23. As a Sensor Node operator, I want to set the Hub's identity once in `HUB_IDENTITY`, so that my Node knows whose announcements to believe.
24. As a Sensor Node operator, I want my Node to ignore Shelter status signed by anyone but that Hub, so that a rogue Node cannot spoof closures.
25. As a developer, I want the Mesh to carry a second message kind next to Community Readings, so that the registry, Community Warnings and Official Alerts can follow without another change to it.
26. As a developer, I want a Mesh message to be checked against the sending Node's key before it reaches any code that acts on it, so that no feature has to re-check who sent it.
27. As a developer, I want the placeholder that opened every Shelter at startup gone, so that no code path still assumes "all open".
28. As the presenter, I want to close a Shelter on the Hub and watch a phone's Evacuation Plan reroute within seconds, so that the demo shows the mesh doing real work.

## Implementation Decisions

- **Mesh widens by one message kind.** Alongside Community Reading, the Mesh publishes and delivers a Shelter status message. Both implementations (Reticulum and in-memory) carry it. Each message still carries its kind and is signed by the sending Node, and a receiver sees the sender identity already verified. The change is kept as small as possible because the Reticulum ticket (0004) is in flight in the same module; coordinate with its owner before touching it, and merge `main` often.
- **Message format is the decided one.** `kind: "shelters"` with `v`, `ver`, `t` and `open` (a list of Shelter ids), a full snapshot every time, under the packet size limit. This spec changes nothing in `wire-formats.md`; the 30 s republish and the "missing means closed" rule are applied as written there.
- **Who may send.** Each Node learns the Hub from a `HUB_IDENTITY` setting (the Hub prints its identity at startup, every other Node sets it once, documented in `.env.example` with a blank value). Only a message signed by that identity is accepted as Shelter status. The Hub itself does not need the setting to send. A Node with no `HUB_IDENTITY` set accepts no Shelter status and so shows nothing open.
- **Shelter status module on every Node.** One deep module holds the latest accepted announcement and answers "which Shelter ids are open". Receiving: accept only from the Hub identity, and only if `ver` is higher than the one held; otherwise ignore. Reading: the open ids, filtered to Shelters that exist in this Node's Cache Pack (an id the pack does not know is ignored). It holds no announcement until one arrives, so the open list is empty and the plan shows the "No open Shelter announced yet" message. It keeps the last announcement if the Hub goes quiet, and forgets it when the Node restarts.
- **The Hub side of the same module** holds the operator's current status, the version counter, and the republish timer. It starts with every Shelter in the Hub's Cache Pack open at version 1, persists version and open list to the Hub's data directory, and on startup loads them so the version never goes backwards. A change bumps the version, updates the Hub's own view at once, publishes immediately, and is then repeated every 30 seconds with the same version. Until a valid Cache Pack is on disk, the Hub neither seeds nor accepts changes (the API answers with an error saying the pack is missing).
- **Node HTTP API.** The open-Shelter read endpoint now returns the status module's open list instead of every pack Shelter, so the 0009 placeholder is removed. The Hub additionally exposes the change endpoint named in `wire-formats.md`, `POST /api/shelters/open`, with a body carrying one Shelter id and whether it is open (`{ "id": "...", "open": false }`); the Hub builds the full snapshot itself. An unknown id is refused with a 422; on a Sensor Node the route does not exist (404). The response returns the resulting open list. When `GET /api/state` arrives (0019) the open ids move into it; this spec does not build it.
- **Dashboard.** The existing open-Shelter polling keeps feeding the Evacuation Plan and the map; no change to the plan function's inputs is needed beyond what the API now returns. Closed Shelters show as closed in the Shelter list. A Hub-only "Hub" button in the top bar opens a slide-over (same styling as the Household panel) with a Shelters tab: every Shelter from the pack, its name, its status, and an open/closed control that calls the Hub endpoint and then shows the result. Only the Shelters tab is built; the registry and warning tabs belong to 0012 and 0013 and are not stubbed. The Hub button is shown only when the Node's role is Hub.
- **Vocabulary.** `CONTEXT.md` gains **Shelter status** (written during the grilling). No ADR: the choices are easy to reverse and follow the decided wire format.

## Testing Decisions

- A good test drives behavior from outside: send a request to a Node, publish on the Mesh, read what the API returns or what the plan shows. It never asserts on module internals, timers or file layout.
- **Seam A, the Node HTTP API (pytest, in-memory Mesh with several Nodes).** Covered: a status set on the Hub shows up on every Node; a Shelter closed on the Hub drops out of every Node's open list; a Shelter missing from a later snapshot shows as closed; a message not signed by the configured Hub identity is ignored; an announcement with an old or equal `ver` is ignored; a Node that has heard nothing reports no open Shelter; a Node keeps its last announcement when the Hub goes quiet; an id unknown to the pack is ignored on receipt and refused with 422 on the Hub; a Sensor Node answers 404 on the change endpoint; the Hub repeats its snapshot on the 30 s cadence (using the test clock helpers) so a late-joining Node converges; and a restarted Hub keeps its status and its version keeps rising. Prior art: the existing Mesh and Node API tests with several Nodes in one process, and the Flood Risk tests that publish hand-made messages.
- **Seam B, the Evacuation Plan function (Vitest).** Already covers "closed Shelters are skipped" and "no open Shelter" from 0009; add a case where the nearest Shelter is open in one input and closed in the next and the plan picks the next nearest. Prior art: the existing Evacuation Plan fixtures.
- **Dashboard flow (Vitest with fetch mocked).** The Hub button appears only for the Hub role; toggling a Shelter in the panel calls the endpoint with the right body and the list reflects the result; a closed Shelter changes the Evacuation Plan shown on the next poll. Prior art: the Household Profile and Evacuation flow tests.
- Rehearsal, not a test: with no Pis, close a Shelter on a loopback Hub and watch a Sensor loopback process and a phone over Tailscale reroute. Report it as rehearsed locally, never as checked on devices.

## Out of Scope

- The registry, sign-up and Unverified Nodes (0012), Community Warnings (0013) and Official Alerts (0014), which will reuse the widened Mesh.
- The rest of the Hub Panel: registry and warning log tabs and the live or replay switch.
- Road distance and routes to the Shelter (0010); "nearest" stays as 0009 left it.
- Capacity, occupancy, or any status beyond open and closed.
- Real county shelter data and verifying the placeholder Shelters in the Cache Pack.
- Pushing Shelter status to a Node that missed it before the next 30 s repeat; no request-on-join.
- `GET /api/state` (0019) and its open-Shelter field.
- Authentication of the Hub operator beyond "this Node is the Hub"; anyone who can reach the Hub's dashboard can change status.
- Real-device checks on Pis or sensors.

## Further Notes

- **Demo reminder.** A Sensor started after the Hub waits up to 30 s for its first snapshot, so start the Sensors before the presentation and let them settle.
- **If `HUB_IDENTITY` is wrong or unset, a Node silently shows nothing open.** That is the safe failure, but say so in the `.env.example` comment and in the run notes so it is the first thing checked.
- **Hub restart with a new identity** needs every Node's `HUB_IDENTITY` updated (already noted in `wire-formats.md`).
- Add a `docs/agents/lessons.md` entry if the Mesh widening surprises anyone.
