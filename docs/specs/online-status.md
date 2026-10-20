# Online status

**Status:** ready-for-agent

> **Cameras removed.** The camera tiles, their routes and the Cameras Panel were deleted with the camera clips (`docs/specs/regions-events-and-sandbox.md`, decision 7); cameras return as sensors in M6. Online / Mesh-only status is unchanged.

Ticket: `docs/tickets/0011-online-status-and-camera-tiles.md` (frozen). Parent spec: `docs/specs/storm-shield.md`. Formats: `docs/specs/wire-formats.md`. Words follow `CONTEXT.md`.

## Problem Statement

A resident looking at the dashboard cannot tell whether the internet is up or whether what they see may be stale. When the cable is pulled mid-storm, anything that needs the internet quietly stops, and nothing on screen says so.

## Solution

The dashboard always says whether its Node is Online or Mesh-only. Everything carried over the Mesh keeps working either way.

## User Stories

1. As a resident, I want the dashboard to say whether its Node is Online or Mesh-only, so that I know which information may be out of date.
2. As a resident, I want the Online or Mesh-only badge in the header next to the Node's name, so that I see it on every screen without looking for it.
3. As a resident, I want the badge to change within a few seconds of the internet dropping, so that I notice the moment it happens.
4. As a resident, I want the badge to change back when the internet returns, so that I know online features are back.
5. As a resident, I want the readings, Flood Risk and map to keep updating while the Node is Mesh-only, so that losing the internet never costs me the information that matters.
6. As a Viewer connected to a Sensor Node that has no internet, I want to see Mesh-only rather than an error, so that I understand the page is working as designed.
7. As a Sensor Node operator, I want my Node to report only its own internet state, so that the badge on my Viewers is true for my Node and not borrowed from another.
8. As a Sensor Node operator, I want a single dropped packet not to flip my Node to Mesh-only, so that the badge does not flicker.
9. As the Hub operator, I want the Hub to keep working when its internet cable is pulled, so that only online-only features stop.
10. As a developer, I want the internet check to be replaceable in tests, so that no test touches the real internet.
11. As a developer, I want the API to stay read-only for connectivity, so that nobody on the Wi-Fi can fake a Node into Mesh-only.
12. As a presenter, I want the cable-pull moment to show the badge change within seconds, so that the audience sees the offline story without a word from me.

## Implementation Decisions

- **Node internet state.** A background loop probes a neutral connectivity endpoint every 5 seconds with a 2 second timeout. The first result decides the starting state (a Node reports Mesh-only until it has one); after that the state flips only after two results in a row, in either direction. The loop catches every exception and logs it, as the other background loops do (0007 review lesson). Each Node reports only its own state; nothing about it travels over the Mesh.
- **Injection.** The connectivity check is passed into the Node's `create_app`, the same way the Mesh is, so tests replace it. There is no public toggle endpoint.
- **API.** `GET /api/node` gains a `status` field with the value `"online"` or `"mesh_only"`. 0019 later moves the same field and values into `GET /api/state`.
- **Dashboard.** A small hook polls the status; if a poll fails the badge keeps its last value, and the "Node unreachable" message belongs to 0019. The badge ("Online" or "Mesh-only") sits in the header next to the Node's name.
- **Settings.** `NODE_INTERNET_CHECK_SECONDS` (default 5) is how often a Node checks the internet; it is listed in `.env.example`, and tests shorten it.
- **Glossary.** **Mesh-only** is defined in `CONTEXT.md` (avoid "offline node"). The badge reads "Online" or "Mesh-only".
- **No new ADR.** The choices are easy to reverse and a future reader will not be surprised by them.

## Testing Decisions

- A good test drives the system only through a seam and asserts what a resident would observe, using the glossary's words in test names. It never reaches into private state, timers or call counts.
- **Seam A: Node HTTP API with the in-memory Mesh (pytest).** With a fake connectivity check injected:
  - a Node reports `online` while its check passes and `mesh_only` after the check fails, and returns to `online` when it passes again;
  - one failed check does not flip the status;
  - with a Node Mesh-only, readings and Flood Risk keep updating;
  - one Node's internet state does not change another Node's status.
- **Dashboard seam (Vitest).** With the status endpoint mocked:
  - the header badge shows "Online" or "Mesh-only" from the status;
  - a failed poll leaves the badge unchanged.
- **Manual check, not unit-tested:** the real probe. Pull the Hub's cable and watch the badge change within seconds, then plug it back in. Run it on a phone as well.

## Out of Scope

- Sharing one Node's internet state with other Nodes over the Mesh.
- A public or demo toggle for internet on and off. A software "pull the cable" backup for the stage would be its own ticket.
- Replacing the status poll with the one-second state snapshot (ticket 0019) and its "Node unreachable" message.

## Further Notes

- The Pi hotspot has no internet, so a Viewer on a Sensor Node behind it always sees Mesh-only. Only the Hub, tethered through a phone, shows Online.
