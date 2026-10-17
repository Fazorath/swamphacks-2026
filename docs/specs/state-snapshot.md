# Dashboard polls one state snapshot

**Status:** ready-for-agent

Ticket: `docs/tickets/0019-dashboard-polls-one-state-snapshot.md`. Parent spec: `docs/specs/storm-shield.md`. Formats: `docs/specs/wire-formats.md` ("Node HTTP API"). Words follow `CONTEXT.md`.

## Problem Statement

The dashboard assembles its screen from several calls that do not agree with each other: an identity call made once, a status poll every 3 s, a stream of readings, and a Flood Risk poll every second. A Node card can say High while the risk chip says Elevated, because they were read at different moments. Each new feature so far added another endpoint or stream.

When the Node stops answering, nothing says so. Each hook handles failure its own way: one keeps the last answer, one clears it, one logs to the console. A resident whose phone has lost its Node can keep looking at readings that look live, which is the worst thing this dashboard can do during a storm. Whether a Node is Stale is also worked out twice, once on the Node and once in the browser with its own 15 s constant.

## Solution

The dashboard reads what it shows about the Mesh from one `GET /api/state`, polled every second. The object is consistent: its readings and Flood Risk come from the same instant. The Node decides which Nodes are Stale, so the browser never repeats the rule.

When the Node stops answering, the dashboard shows **Node unreachable**. Live readings, Flood Risk, online status and the camera tiles disappear, so nothing stale looks live. The map, the Cache Pack and the Household Profile stay, because they are already on the Viewer's device or came from the Cache Pack. Before the first answer the dashboard shows a neutral "Connecting…", not an error.

Later tickets add their fields to this one object instead of adding endpoints.

## User Stories

1. As a resident, I want the readings, Flood Risk and Node status on my screen to come from the same instant, so that the dashboard never contradicts itself.
2. As a resident, I want to be told "Node unreachable" when my phone cannot reach its Node, so that I do not trust numbers that stopped updating.
3. As a resident, I want live readings and Flood Risk to disappear when my Node is unreachable, so that a frozen number is never mistaken for a current one.
4. As a resident, I want the map, Shelters and my Household Profile to stay visible while my Node is unreachable, so that I can still plan where to go.
5. As a resident, I want a brief Wi-Fi hiccup of a second or two not to flash an error, so that the warning means something when it appears.
6. As a resident, I want the warning gone the moment my Node answers again, so that I am not left staring at a banner that is no longer true.
7. As a resident opening the dashboard, I want a neutral "Connecting…" until the first answer, so that I am not told the Node is unreachable before I have tried.
8. As a resident, I want camera tiles to disappear while my Node is unreachable, so that an old picture is never taken for a live one.
9. As a resident, I want Nodes silent for 15 seconds marked Stale with their age, so that I can see which readings are old.
10. As a resident, I want a Simulated Reading labeled as such, so that I never mistake a demo number for a real one.
11. As a resident, I want my own Node marked on the map, so that I know which dot is the device I am connected to.
12. As a resident, I want to see whether my Node is Online or Mesh-only, so that I know whether camera tiles and live feeds can work.
13. As a resident, I want the Scenario step on my Node's screen, so that I know where the demo storm is.
14. As a Hub operator, I want the Hub's dashboard to use the same snapshot, so that I do not have a separate set of numbers.
15. As a Sensor Node operator, I want the Scenario step and reset buttons to keep working and update the screen within a second, so that I can drive the demo.
16. As a teammate building a later feature, I want to add a field to the one state object, so that I do not add an endpoint, a stream and a hook.
17. As a teammate building Flood Risk or Community Warnings, I want the Stale rule in one place on the Node, so that the 15 s flag and the 60 s "stops counting" rule cannot drift.
18. As a teammate building the Node registry, I want readings grouped per Node, so that `registered` sits beside `stale` and `age_s` and the values cannot disagree.
19. As a resident, I want my Household Profile to stay on my device on every poll, so that polling never reveals my home.
20. As a judge reading the repo, I want one endpoint and one hook, so that the data flow is easy to follow.

## Implementation Decisions

- **One endpoint.** `GET /api/state` returns, in one consistent object:
  - this Node's `id`, `name`, `role` and `status` (`online` or `mesh_only`);
  - the Scenario step;
  - Flood Risk (level, reasons, Storm Signal, per-Node levels) in the shape `/api/flood-risk` served;
  - every Node's latest readings, this one included.
- **Readings are grouped per Node.** Each Node entry carries `id`, fuzzed `position`, the simulated flag, `age_s`, `stale`, and its four measurements (pressure, rain rate, water level, soil moisture, each with value and unit). `age_s`, `stale` and the simulated flag are per Node, not per measurement. Later tickets add `registered` to the same entry.
- **The Node decides Stale.** `stale` means silent for more than 15 s on the receiving Node's own clock. The 15 s and the 60 s "stops counting toward Flood Risk" thresholds live side by side in the Node's one timing module, so the Flood Risk rule and the Stale flag read the same values. The dashboard's own 15 s constant is deleted and the dashboard only reads `stale`.
- **What does not move in.** Shelter open ids (`/api/shelters`), camera tiles (`/api/cameras` and pictures) and the Cache Pack endpoints keep their own endpoints. Shelters can fold in later with a small follow-up.
- **Endpoints removed, not left beside the new one:** `/api/node`, `/api/readings`, `/api/readings/stream`, `/api/flood-risk` and `GET /api/scenario`. The Scenario step and reset POSTs stay and keep returning the step. Wherever `docs/specs/wire-formats.md` still mentions the removed endpoints it is updated.
- **Fields of later tickets are not added here** (Official Alerts, Community Warnings, `registered`, Shelter ids). Flood Risk is the exception, because it already exists and must agree with the readings.
- **One polling hook.** `useNodeState()` is called once in `App`. It returns the latest state and a `connection` of `connecting`, `connected` or `unreachable`, and `App` passes the pieces down as props as it does today. `useNodeIdentity`, `useNodeStatus`, `useReadings` and `useFloodRisk` are deleted. No context provider.
- **Polling rules.** The hook polls every second with a chained timeout: it waits for the response (or a 2 s request timeout), then waits out the rest of the second, so requests never overlap. `connection` becomes `unreachable` after 3 failed polls in a row, a failure being a network error, a non-OK answer or a timeout. Any success returns it to `connected` and replaces the state. Before the first answer it is `connecting`.
- **While unreachable.** Readings, Flood Risk, online status and camera tiles are cleared, and camera polling stops. The map, Cache Pack content, Shelters and Household Profile stay. The "Node unreachable" message is shown in the dashboard.
- **Cameras.** `/api/cameras` keeps its own poll. It is stopped while the Node is unreachable and resumes with it.
- **Glossary.** **Node unreachable** is defined in `CONTEXT.md`: the Viewer's link to its own Node, distinct from Mesh-only and Stale.
- **No new ADR.** The one-snapshot decision is already in the wire formats spec, and is cheap to reverse.

## Testing Decisions

- **A good test** checks what a resident or another Node can observe: the JSON `GET /api/state` returns, and what the dashboard shows. It does not check which hook or function made the call.
- **Seam A (Node API, pytest).** Tests use the existing in-memory Mesh harness (`MeshedNodes`). Cases:
  - the state shows this Node's own readings and other Nodes' readings, grouped per Node;
  - it carries `id`, `name`, `role` and `status`, and the Scenario step;
  - a Node that stops publishing turns `stale` after 15 s and reports a growing `age_s`, using the harness clock (`advance`);
  - Flood Risk in the state agrees with the readings in the same response;
  - the removed endpoints answer 404.
- **Dashboard seam (Vitest).** `App` renders from a fake `/api/state`. Cases:
  - it shows `Connecting…` before the first answer;
  - it shows readings, risk and status from the fake state;
  - one or two failed polls leave the screen unchanged, and the third shows "Node unreachable" and clears readings, Flood Risk, status and camera tiles;
  - the next good poll clears the message and restores the data;
  - the Cache Pack map and Household Profile stay visible while unreachable.
- **Privacy test (0008).** "No request carries the Household Profile" now runs several real poll cycles, with fake timers, and asserts that every request is one of the Node's known paths with no profile in it. This was promised in `docs/agents/lessons.md`.
- **Prior art.** `node/tests/test_node_api.py`, `test_flood_risk.py` and `test_online_status_and_cameras.py` on the Node side; `App.test.tsx`, `onlineStatusFlow.test.tsx` and `householdFlow.test.tsx` on the dashboard side. Tests that used the old endpoints move to the new one rather than being rewritten from scratch.
- **Not tested.** Real Wi-Fi drops on a phone. The software path is rehearsed locally: stop the Node process and watch the dashboard on a phone over Tailscale.

## Out of Scope

- Official Alerts, Community Warnings, the `registered` flag and the Node registry (tickets 0012 to 0014).
- Folding Shelter open ids, camera tiles or the Cache Pack into the state.
- The 60 s "stops counting" and 10 min "removed from map" behaviour (0021); this ticket only moves the existing thresholds into one place and adds the Stale flag.
- Restarted-Node sequence handling (0022).
- The new dashboard design (0032 to 0039); this ticket keeps the current layout and only changes where the data comes from.
- Changing the poll interval, or any push channel (server-sent events were dropped on purpose).

## Further Notes

- `docs/specs/wire-formats.md` says "Changing anything here needs the whole team". Its "Node HTTP API" section needs the state's `id`, per-Node readings and Flood Risk, and the removed endpoints written in. Post it in the group chat when it merges.
- Tickets 0021, 0022 and 0037 are blocked by this one. 0037 will find `useReadings` gone and should read from the state instead.
- A 3-failure rule needs about 3 s to show "Node unreachable"; this is deliberate, so a brief Wi-Fi blip does not flash a warning.
