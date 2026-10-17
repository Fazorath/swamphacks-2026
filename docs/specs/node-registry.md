# Node registry and Unverified Nodes

**Status:** ready-for-agent

Ticket 0012. Builds on `docs/specs/storm-shield.md` (Registry module) and the registry and sign-up formats in `docs/specs/wire-formats.md`. Words follow `CONTEXT.md`. Decided in the grilling of 2026-10-17.

## Problem Statement

Any device that joins the neighbourhood Wi-Fi can run a Node and publish Community Readings. Today every Node's readings count toward Flood Risk, so a misconfigured Node, a broken sensor or someone fooling around can push a resident's Flood Risk to High, and later a Community Warning, with nothing to tell the resident who that Node is. The Hub operator has no list of who is on the Mesh and no way to say "these are ours". Map labels and Node cards show other Nodes only by their 12-character Node id, because there is nowhere to learn their names.

## Solution

A Node's operator presses "Sign up with the Hub" in the Node Panel on that Node's own screen. The Node keeps sending a signed Sign-up over the Mesh until the Hub operator accepts it in the Hub Panel's Registry tab. Accepting adds the Node to the Node registry. The Hub signs the registry and shares it over the Mesh, and every Node keeps the latest valid copy.

Every Node then counts only Registered Nodes toward Flood Risk. Unverified Nodes are still shown, greyed out and tagged NOT COUNTED, so residents can see them and see why they don't count. Registered Nodes show their Node name on the map and their cards. The Hub keeps the registry across restarts, and the demo script registers its Sensors, so the demo starts with every Node counting.

## User Stories

1. As a resident, I want readings from Unverified Nodes shown greyed out and tagged NOT COUNTED, so that I understand why they don't affect my Flood Risk.
2. As a resident, I want an Unverified Node pushed to High to leave my Flood Risk unchanged, so that a stranger's device cannot frighten me.
3. As a resident, I want Unverified Node cards listed after the Registered ones under a "Not counted" divider, so that the Nodes that matter are on top.
4. As a resident, I want an Unverified Node's map marker drawn as a hollow dot with a dashed grey outline, so that I can tell it apart at a glance without reading labels.
5. As a resident, I want Registered Nodes labelled with their Node name instead of a code, so that I know "garage" is my neighbour's porch Node.
6. As a resident, I want Unverified Nodes labelled by Node id, so that nothing they claim about themselves is shown as fact.
7. As a resident whose Node has heard no registry yet, I want no Flood Risk at all rather than a level built from unknown Nodes, so that the screen never overstates what it knows.
8. As a Node operator, I want a "Sign up with the Hub" button in the Node Panel, so that I can ask for my Node to count.
9. As a Node operator, I want the Node Panel to show `UNVERIFIED`, then "Sign-up sent, waiting for the Hub", then `REGISTERED`, so that I know where my request stands.
10. As a Node operator, I want my Node to keep resending its Sign-up until the Hub has accepted it, so that one lost packet doesn't leave me waiting forever.
11. As a Node operator, I want the Node Panel only on my Node's own screen, so that Viewers on phones cannot sign my Node up or see its controls.
12. As a Node operator, I want my own Node's readings to count on my screen only once it is Registered, so that my screen agrees with what the rest of the valley sees.
13. As a Node operator, I want my `THIS NODE` card tagged NOT COUNTED while Unverified, so that I'm not misled by my own readings.
14. As the Hub operator, I want a Registry tab in the Hub Panel listing every Node with its name, Node id, status and last heard, so that I know who is on the Mesh.
15. As the Hub operator, I want waiting Sign-ups marked `SIGN-UP WAITING` with an Accept button, so that I can let a Node count with one click.
16. As the Hub operator, I want Nodes I've heard that never signed up listed as `UNVERIFIED` by Node id, so that I can spot unknown devices.
17. As the Hub operator, I want the Registry tab's badge to count waiting Sign-ups, so that I notice requests without opening the tab.
18. As the Hub operator, I want the Hub always listed as Registered, so that the Hub's own readings count everywhere without it signing up to itself.
19. As the Hub operator, I want an accepted Node to count on every Node within seconds, so that accepting has a visible effect during the demo.
20. As the Hub operator, I want the registry kept across a Hub restart, so that a restart mid-demo doesn't turn the whole valley Unverified.
21. As the Hub operator, I want a Hub with an unreadable registry file to refuse to start and name the file, so that I never run with a silently empty registry.
22. As the Hub operator, I want an accept that would make the registry too big for one packet refused with a clear message, so that the registry never silently stops reaching Nodes.
23. As the Hub operator, I want a failed save of the registry to change nothing and report an error, so that what Nodes hear always matches what is on disk.
24. As a Node, I want to keep the registry with the highest `ver` I have received, so that an old copy relayed late cannot undo an accept.
25. As a Node, I want to ignore any registry not signed by the configured Hub, so that nobody can register themselves by announcing a list.
26. As a Node, I want to ignore a registry that says it spans several packets, so that a newer Hub cannot leave me with half a list.
27. As a Node joining late, I want the Hub to republish the registry every 30 s, so that I converge without asking.
28. As a Node with no `HUB_IDENTITY` configured, I want to count nobody, so that a misconfiguration fails safe instead of trusting every sender.
29. As the Hub, I want to accept a Sign-up only when its signature matches the Node id it names, so that one Node cannot sign another up.
30. As a teammate, I want the Sign-up to be a broadcast that names its Node, so that it works on the Mesh we have, which cannot address one Node.
31. As a teammate running the one-laptop demo, I want the demo script to sign up S0 to S3 and accept them on the Hub, so that every Node counts from the first beat.
32. As a teammate writing tests, I want a harness helper that registers Nodes, so that tests of Flood Risk rules don't each rebuild a registry.
33. As a teammate building Community Warnings (0013) and the Surge (0046), I want "is this Node Registered?" answered in one place, so that a warning can never come from an Unverified Node.
34. As a judge reading the repo, I want the registry rules in one module, so that the trust model is easy to audit.

## Implementation Decisions

- **Sign-up message.** `{ "v": 1, "kind": "signup", "node": "<Node id>", "name": "<Node name>" }`, broadcast on the Mesh and signed by the sending Node like a Community Reading. It carries `node` because the Mesh has no addressed send, and signature checking finds the signer's key from `node`. Every other kind is checked against the Hub key. Nodes other than the Hub ignore Sign-ups. This is the team-wide change to `wire-formats.md`.
- **Signature rules.** The Reticulum `verify` step treats `signup` like a reading: it verifies against the key announced for its `node`, and it drops the Sign-up if that Node hasn't announced or the signature fails. `registry` falls under the existing rule that kinds without `node` must be signed by `HUB_IDENTITY`. Both Meshes already filter Hub-only kinds before listeners run; `signup` is added to the kinds any announced Node may send.
- **Registry message.** As in `wire-formats.md`: a full snapshot with `ver`, `t` and `nodes: [{ id, name }]`. The Hub always sends `part: 1, of: 1` and always lists itself under its own Node name. A receiver ignores `of` above 1.
- **Registry module (one deep module, both roles).**
  - On every Node it holds the latest Hub-signed registry: it keeps a received registry only if its `ver` is higher than the one held, and it answers "is this Node id Registered?" and "what is this Node's registry name?". With no registry received, nobody is Registered, this Node included.
  - On the Hub it is the source of truth. It records waiting Sign-ups (Node id, name, when heard) in memory only. Accepting moves a waiting Node into the registry, bumps `ver`, saves, and publishes at once. A loop republishes the current snapshot every 30 s, reusing the Shelter status repeat pattern.
  - The Hub saves `ver` and the list to a file in its data dir, following `shelter_status.json` (0030): a restart publishes saved `ver` + 1, an unreadable file stops the Hub with an error naming the file, and a failed save changes nothing in memory, publishes nothing and returns 500. Deleting the file starts over with only the Hub.
  - An accept that would make the signed registry bigger than one Reticulum packet answers 409 and changes nothing.
- **Sign-up loop on a Sensor.** `POST /api/registry/signup` starts sending this Node's Sign-up with every announce (about 10 s) until this Node's id appears in the registry, then stops. The press is not saved: after a restart, a Node that is still not Registered is back to `unverified`. Calling it again while waiting or Registered changes nothing.
- **Flood Risk.** The one check that already decides whether a Node's readings count now also requires the Node to be Registered. The Flood Risk function takes the registry, or the set of Registered ids, as a second input, alongside the 60 s silence rule that 0021 will add to the same check. The Hub's Community Warning decision (0013) uses the same answer.
- **HTTP API.**
  - `/api/state`: every Node entry gains `registered: bool` and `name: string | null` (the registry name; `null` when Unverified). The top level gains `registration: "unverified" | "waiting" | "registered"` for this Node, and the Hub always reads `registered`.
  - `POST /api/registry/signup` exists on every Node.
  - On the Hub only: `GET /api/registry` returns `{ ver, nodes: [{ id, name, status: "registered" | "waiting" | "unverified", last_heard_s }] }`, and `POST /api/registry/accept` takes `{ id }`. Accept answers 404 for a Node with no waiting Sign-up and 409 when the registry is full. A Sensor answers 404 on both Hub routes.
  - The Registry tab rows are: every Registered Node (the Hub included) as `registered`, every waiting Sign-up as `waiting` with its Sign-up name, and every Node heard over the Mesh that never signed up as `unverified` with `name: null`.
- **Dashboard** (reads the one state snapshot, as 0041 left it):
  - Node cards and map markers use the Unverified look from `ui.md`: hollow dot, dashed grey outline, `NOT COUNTED` tag, contrast at least 4.5:1. Cards are ordered this Node first, then Registered Nodes A to Z, then Unverified Nodes under a "Not counted" divider.
  - Labels use the registry name when there is one, otherwise the Node id. This Node keeps its configured name.
  - A new Node Panel (slide-over, same styling as the Hub Panel) has only the Registration section: the status line and the "Sign up with the Hub" button. It is opened by a "Node" button in the top bar, shown only when the dashboard is on `localhost`. The Scenario controls stay where they are for now.
  - The Hub Panel gains the Registry tab as its default tab, with Node name, Node id in mono, status tag, last heard, Accept for waiting rows, and a badge counting waiting Sign-ups. After Accept, the tab shows the result at once and polling takes over, like the Shelters tab.
  - Icons follow `F-Icons`: `shield-check` for Registered, `shield-question-mark` for Unverified, `user-plus` for Sign-up waiting, `circle-dashed` for Not counted, `list-checks` for the tab.
- **Names.** The registry stores the Sign-up's name as is. Duplicates are allowed, since the Node id tells Nodes apart; the demo keeps names unique by convention.
- **Demo script.** The one-laptop demo script signs up S0 to S3 and then accepts each on the Hub, reusing one Hub data dir so the registry persists between runs.
- **Order of work.** First the Node half (messages, registry module, counting, API) with its Seam A and `verify` tests, then the dashboard half.

## Testing Decisions

- **Good tests here check what a Node or a Viewer can observe**: what `/api/state` and the registry routes return, what the dashboard shows and which requests it sends. They never check how the registry is stored in memory. Time moves through the injected clock, and loops run with short test intervals as in 0029.
- **Seam A, the Node HTTP API over the in-memory Mesh (`MeshedNodes`).** It covers:
  - an Unverified Node pushed to High leaves Flood Risk unchanged, and after it is Registered the same readings make it High;
  - no registry received means no Node counts, this Node included;
  - a sign-up followed by an accept on the Hub reaches a Sensor's registry, and the Sensor's `registration` goes from `unverified` to `waiting` to `registered`;
  - a lower `ver` is ignored;
  - a registry not from the Hub is ignored, and so is one with `of` above 1;
  - `/api/state` carries `registered` and `name`;
  - `GET /api/registry` lists Registered, waiting and Unverified rows;
  - accept answers 404 for an unknown Node and 409 when the registry would not fit one packet;
  - a Hub restart publishes saved `ver` + 1 and keeps its Nodes, and an unreadable registry file stops the Hub;
  - a Sensor answers 404 on the Hub routes.

  New harness helpers: `announce_registry(ver, nodes, sender=...)` publishes a hand-made registry (like `announce_shelters`), and `register(*names)` registers Nodes so existing Flood Risk, state snapshot, replay and alert tests keep counting.
- **Reticulum `verify` (unit, as in the existing signature tests).** It covers:
  - a Sign-up verifies against the key of the Node it names;
  - a Sign-up signed by a different Node is dropped;
  - a Sign-up from a Node that hasn't announced is dropped;
  - a registry signed by anyone but the Hub is dropped;
  - a full signed registry fits one packet (like the 0014 alert size test).
- **Dashboard flow tests (Vitest, `fakeNodeState()` / `fakeNodeSnapshot()`, as in the Replay controls and Hub Panel flows).** They cover:
  - an Unverified Node's card is greyed, tagged NOT COUNTED and below the divider;
  - a Registered Node shows its registry name;
  - the Node button shows only on `localhost`, and its Sign-up button posts `POST /api/registry/signup` and shows the three states;
  - the Registry tab lists rows with the right tags and badge, and Accept posts `POST /api/registry/accept` and shows the change before the next poll.
- **Rehearsal, not automated:** the demo script registering S0 to S3 on loopback Reticulum, and a Sign-up and accept between a loopback Hub and Sensor with `HUB_IDENTITY` set. Report it as a software-path rehearsal only, not a Pi check.

## Out of Scope

- Rejecting a waiting Sign-up, or removing or revoking a Registered Node.
- Renaming a Registered Node, or re-registering after a name change.
- Unique-name enforcement.
- Registries that span several packets (`part` / `of` above 1).
- Saving the Sign-up press or the received registry on Sensors.
- Moving the Scenario controls into the Node Panel.
- Putting an Unverified Node on stage in the demo.
- Community Warnings themselves (0013) and the silence cutoff (0021), which reuse the counting check built here.

## Further Notes

- The Sign-up format change touches every teammate's understanding of `wire-formats.md`; it was posted in the group chat with the other decisions.
- Strict counting means that after this lands, any Node run without a Hub, or before the Hub's first registry arrives, shows no Flood Risk. That is intended. Check `HUB_IDENTITY` first when everything reads NOT COUNTED.
- A Hub restarted with a new identity makes every Node drop its registry until `HUB_IDENTITY` is updated (0004's note).
