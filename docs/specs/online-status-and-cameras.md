# Online status and camera tiles

**Status:** ready-for-agent

> **Camera list and fields:** see "The camera list" in `docs/specs/flash-flood-replay.md` (ticket 0075).
>
> **Camera source superseded.** The FL511 cameras give way to one replay camera on the Hub (`docs/specs/flash-flood-replay.md`, ticket 0038). Online / Mesh-only status is unchanged.

Ticket: `docs/tickets/0011-online-status-and-camera-tiles.md`. Parent spec: `docs/specs/storm-shield.md`. Formats: `docs/specs/wire-formats.md`. Words follow `CONTEXT.md`.

## Problem Statement

A resident looking at the dashboard cannot tell whether the internet is up or whether what they see may be stale. Public camera images are the one thing on screen that needs the internet, and a camera image that stops updating looks exactly like a live one. When the cable is pulled mid-storm, a frozen road camera can make someone think a road is clear when nobody knows.

## Solution

The dashboard always says whether its Node is Online or Mesh-only. While Online, a Cameras panel shows four public road cameras, each with how long ago its picture was taken. When the Node goes Mesh-only, the tiles grey out, read "Offline" and show no picture at all, so a stale photo can never be mistaken for a live one. Everything carried over the Mesh keeps working either way. A camera that fails while the Node is Online reads "Unavailable", in a style distinct from the Offline grey.

## User Stories

1. As a resident, I want the dashboard to say whether its Node is Online or Mesh-only, so that I know which information may be out of date.
2. As a resident, I want the Online or Mesh-only badge in the header next to the Node's name, so that I see it on every screen without looking for it.
3. As a resident, I want the badge to change within a few seconds of the internet dropping, so that I notice the moment it happens.
4. As a resident, I want the badge to change back when the internet returns, so that I know cameras are live again.
5. As a resident, I want road camera tiles while the Node is Online, so that I can see roads and water nearby.
6. As a resident, I want each tile to say how long ago its picture was taken, so that I can judge how current it is.
7. As a resident, I want the tiles to grey out and read "Offline" when the Node is Mesh-only, so that I do not think a frozen image is live.
8. As a resident, I want an Offline tile to show no picture at all, so that an old photo cannot pass for a live one.
9. As a resident, I want a camera that has failed to read "Unavailable" and look different from an Offline tile, so that I can tell a broken camera from a lost connection.
10. As a resident, I want one broken camera to leave the other tiles working, so that one bad feed does not hide the rest.
11. As a resident, I want the readings, Flood Risk and map to keep updating while the Node is Mesh-only, so that losing cameras never costs me the information that matters.
12. As a resident on a phone, I want the Cameras panel to fit the screen and not push the map and readings out of reach, so that the page stays usable.
13. As a Viewer connected to a Sensor Node that has no internet, I want to see Mesh-only and Offline tiles rather than an error, so that I understand the page is working as designed.
14. As a Sensor Node operator, I want my Node to report only its own internet state, so that the badge on my Viewers is true for my Node and not borrowed from another.
15. As a Sensor Node operator, I want a single dropped packet not to flip my Node to Mesh-only, so that the badge does not flicker.
16. As the Hub operator, I want the Hub's tiles to grey out when I pull its internet cable, so that the offline story is visible on stage.
17. As the Hub operator, I want the Hub to keep working when its cable is pulled, so that only online-only features stop.
18. As the Hub operator, I want camera images to be fetched once and shared with every Viewer, so that twenty phones do not become twenty requests to the camera service.
19. As the Hub operator, I want camera fetches to happen no more than once a minute per camera, so that we stay polite to a feed we do not own.
20. As a developer, I want the internet check and the camera source to be replaceable in tests, so that no test touches the real internet.
21. As a developer, I want the API to stay read-only for connectivity, so that nobody on the Wi-Fi can fake a Node into Mesh-only.
22. As a developer, I want the status to appear on the existing Node endpoint, so that ticket 0019 can fold it into the state snapshot without changing its values.
23. As a developer, I want the camera list to live in one file in the repo, so that swapping a camera or the whole source is a small change.
24. As a presenter, I want the cable-pull moment to show the badge change and the tiles grey out within seconds, so that the audience sees the offline story without a word from me.
25. As a presenter, I want the Cameras panel to read clearly from the back of a room, so that the Offline state lands.

## Implementation Decisions

- **Source of camera images.** FL511's own website feed, which needs no key or account, as a stopgap until something better turns up. The camera source module hides how pictures are fetched. It is not a documented API and may change, so it is the one place to change if the source changes. The decision and the cameras checked are recorded in ticket 0011.
- **Camera list.** Four fixed I-75 cameras in Alachua County, kept in one repo file: SR-24 / Archer Rd (southbound), SR-26 / Newberry Rd (southbound), SR-121 / Williston Rd (northbound) and Paynes Prairie (northbound). No runtime lookup of the camera list; the upstream list endpoint is not depended on.
- **Fetching and sharing.** The Node fetches each camera at most once every 60 seconds, only while Online, keeps the latest picture in memory with the time it was taken, and serves it to every Viewer. Viewers never talk to the camera service. A failed fetch keeps nothing new and marks that camera Unavailable once its last picture is too old to call live. A camera that fails waits out the same minute before it is tried again. Cameras refresh in their own background loop, apart from the internet check, so slow cameras never delay noticing that the cable is out.
- **Node internet state.** A background loop probes a neutral connectivity endpoint every 5 seconds with a 2 second timeout. The first result decides the starting state (a Node reports Mesh-only until it has one); after that the state flips only after two results in a row, in either direction. The loop catches every exception and logs it, as the other background loops do (0007 review lesson). Each Node reports only its own state; nothing about it travels over the Mesh.
- **Injection.** The connectivity check and the camera source are both passed into the Node's `create_app`, the same way the Mesh is, so tests replace them. There is no public toggle endpoint.
- **API.** `GET /api/node` gains a `status` field with the value `"online"` or `"mesh_only"` (the spec's `online` / `mesh_only` wording). 0019 later moves the same field and values into `GET /api/state`. A new read-only `GET /api/cameras` lists the tiles (id, label, state, when the picture was taken and its age as the Node counts it), and `GET /api/cameras/{id}.jpg` returns the latest picture while the Node is Online and a clear non-image answer (503) when it is not or when that camera has no usable picture; an unknown camera is a 404. A picture is live for 3 minutes after it was fetched; older than that, the camera is Unavailable.
- **Camera tile states.** Live: the picture and "updated Ns ago". Offline: the Node is Mesh-only; grey tile, the word "Offline", no picture. Unavailable: the Node is Online but this camera has no usable picture. Offline and Unavailable look different.
- **Dashboard.** Small hooks poll `/api/node` (the badge) and `/api/cameras` (the tiles) every 3 seconds until 0019's one-second snapshot replaces them; the two can disagree for up to one poll. If a poll fails the badge keeps its last value; the "Node unreachable" message belongs to 0019. The badge ("Online" or "Mesh-only") sits in the header next to the Node's name. A new Cameras panel sits below the Readings panel. A tile's image address carries the time its picture was taken, so a new picture is a new address and a browser never shows an older copy as new. On a phone the panel stacks and does not displace the map.
- **Secrets and settings.** There is no camera key, so no secret is added to `.env`. The one new setting, `NODE_INTERNET_CHECK_SECONDS` (default 5), is how often a Node checks the internet and whether a picture is due; it is listed in `.env.example`, and tests shorten it. Camera images still reach the dashboard only through the Node.
- **Glossary.** **Mesh-only** is defined in `CONTEXT.md` (avoid "offline node"). The badge reads "Online" or "Mesh-only"; tiles read "Offline" and "Unavailable".
- **No new ADR.** The choices are easy to reverse and a future reader will not be surprised by them.

## Testing Decisions

- A good test drives the system only through a seam and asserts what a resident would observe, using the glossary's words in test names. It never reaches into private state, timers or call counts.
- **Seam A: Node HTTP API with the in-memory Mesh (pytest).** With a fake connectivity check and a fake camera source injected:
  - a Node reports `online` while its check passes and `mesh_only` after the check fails, and returns to `online` when it passes again;
  - one failed check does not flip the status;
  - a camera picture is served while Online, and the endpoint serves no picture while Mesh-only;
  - a camera whose fetch fails reports Unavailable without affecting the other cameras;
  - with a Node Mesh-only, readings and Flood Risk keep updating (the spec's existing internet-off behavior);
  - one Node's internet state does not change another Node's status.
- **Dashboard seam (Vitest).** With `/api/node` and the image endpoint mocked:
  - the header badge shows "Online" or "Mesh-only" from the status;
  - when a later poll reports Mesh-only, the tiles read "Offline" and show no image;
  - an Unavailable tile looks different from an Offline tile;
  - a failed poll leaves the badge unchanged.
- **Prior art:** `test_map_tiles.py` (a proxy with a fake upstream), `test_node_api.py` and `MeshedNodes` for Seam A; `householdFlow.test.tsx` and `App.test.tsx` for the dashboard.
- **Manual check, not unit-tested:** the real FL511 feed and the real probe. Pull the Hub's cable and watch the badge change and the tiles grey out within seconds, then plug it back in. Run it on a phone as well.

## Out of Scope

- Live camera video, and any camera feed while Mesh-only.
- Sharing one Node's internet state with other Nodes over the Mesh.
- A public or demo toggle for internet on and off. A software "pull the cable" backup for the stage would be its own ticket.
- Choosing cameras by distance from a Node, or showing more than four tiles.
- Camera tiles on the map, and any camera outside Alachua County.
- Replacing the status poll with the one-second state snapshot (ticket 0019) and its "Node unreachable" message.
- A documented camera API or a key for one; the FL511 developer API is not available to us.

## Further Notes

- The FL511 feed is the website's own endpoints, not a documented API. Treat the camera source as replaceable and say so in the report if it breaks during the event. The Cache Pack lessons about flaky upstreams apply: retry and never let one failure take a loop down.
- The fixed camera ids were checked on 2026-10-17; each served a live JPEG with a one-minute cache.
- The Pi hotspot has no internet, so a Viewer on a Sensor Node behind it always sees Mesh-only and Offline tiles. Only the Hub, tethered through a phone, shows live cameras.
