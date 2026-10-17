# 0012: Node registry and Unverified Nodes

**What to build:** A Node signs up with the Hub, and the Hub operator accepts its identity. The Hub shares a signed registry over the mesh. Every Node then counts only Registered Nodes toward Flood Risk, and shows Unverified Nodes greyed out and marked "not counted". The Hub's dashboard shows the registry.

**Blocked by:** 0006, and the registry format (decided, `docs/specs/wire-formats.md`).

**Status:** in-progress

**Owner:** amitathik7

**Spec:** `docs/specs/node-registry.md` (from `docs/specs/storm-shield.md`)

**Design:** `docs/design/ui.md` ("Hub Panel", "Node Panel"); canvas artboards `D-Hub-Registry`, `D-Node-Registration`, `D-StaleUnverified`.

- [ ] Node sign-up through the API: `POST /api/registry/signup` starts a signed `signup` broadcast every announce until this Node is in the registry; the Hub records it as waiting, and `POST /api/registry/accept` makes it Registered
- [ ] The Hub publishes the registry over Mesh, signed with its identity, always listing itself, on every change and every 30 s; it saves it in `NODE_DATA_DIR/registry.json`; Nodes keep the highest valid `ver`
- [ ] Flood Risk counts only readings from Registered Nodes (`flood_risk._counts`); before any registry arrives nothing counts
- [ ] `/api/state` gives each Node entry `registered` and `name`, and this Node's `registration`
- [ ] The dashboard greys out Unverified Nodes and marks them "not counted"
- [ ] A localhost-only Node Panel with the Registration section ("Sign up with the Hub")
- [ ] The Hub dashboard shows the Node registry (Registry tab, `GET /api/registry`)
- [ ] Seam A tests: an Unverified Node pushed to High does not change Flood Risk; after registration it does; a registry not signed by the Hub is ignored; a lower `ver` and a registry with `of` above 1 are ignored; an accept that would not fit one packet gets 409; the Hub restarts at saved `ver` + 1
- [ ] `scripts/run-demo.sh` signs up S0 to S3 and accepts them on the Hub, so the demo still counts every Node
- [ ] All **Commands** pass

## Decisions (grilling, 2026-10-17)

- **Sign-up is a broadcast, not an addressed message.** It is `{ "v": 1, "kind": "signup", "node": ..., "name": ... }`, signed by the Node and checked against `node` like a reading. Nodes other than the Hub ignore it. This changes `wire-formats.md`; tell the team.
- **The sign-up is triggered by a button** in a new Node Panel, shown only on `localhost`, holding only the Registration section (Scenario controls stay in the Readings Panel for now). A press resends every announce (about 10 s) until the Node is Registered. A restart forgets the press.
- **This Node's state** is `registration: "unverified" | "waiting" | "registered"` in `/api/state`. The Hub is always `registered`.
- **Strict counting.** No registry yet, or a blank `HUB_IDENTITY`, means no Node counts, this one included. Existing tests that expect a Flood Risk level get a `MeshedNodes` helper that publishes a hand-made Hub registry.
- **The Hub is always in its own registry.** A Node's own readings count on its own screen only once it is Registered.
- **The Hub persists the registry** like `shelter_status.json` (0030): restart at saved `ver` + 1, an unreadable file stops the Hub with an error naming it, and a failed save changes nothing and returns 500. Pending sign-ups are kept only in memory. Sensors do not save the registry.
- **One packet only.** The Hub always sends `part: 1, of: 1` and refuses an accept that would not fit (409). Receivers ignore `of` above 1. A test guards the size, as in 0014.
- **API:** every `/api/state` Node entry gains `registered` and `name` (`null` when Unverified). The Hub-only `GET /api/registry` returns `{ ver, nodes: [{ id, name, status: "registered" | "waiting" | "unverified", last_heard_s }] }`. The tab lists Registered Nodes (the Hub included), waiting sign-ups with Accept, and heard-but-never-signed-up Nodes by id. The badge counts waiting sign-ups. Accept publishes at once.
- **Names** come from the sign-up as is. Duplicates are allowed; the Node id tells Nodes apart. The demo keeps names unique by convention, and nothing enforces it.
- **Order of work:** the Node half and its Seam A tests first, then the dashboard half (0041 is done, so it reads `useNodeState`).
- **Demo:** 0049 is done, so 0012 itself adds to `scripts/run-demo.sh` a call to `POST /api/registry/signup` on S0 to S3 and then `POST /api/registry/accept` on the Hub, reusing one Hub data dir. 0012 puts no Unverified Node on stage; it proves it with tests and a loopback rehearsal.
- **Out of scope:** rejecting or removing a Node, renaming a Registered Node, and multi-packet registries.
