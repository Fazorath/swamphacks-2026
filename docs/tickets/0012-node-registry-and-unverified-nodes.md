# 0012: Node registry and Unverified Nodes

**What to build:** A Node signs up with the Hub, and the Hub operator accepts its identity. The Hub shares a signed registry over the mesh. Every Node then counts only Registered Nodes toward Flood Risk, and shows Unverified Nodes greyed out and marked "not counted". The Hub's dashboard shows the registry.

**Blocked by:** 0006, and the registry update message format in the UI design doc

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] Node sign-up through the API; the Hub records the Node's identity as Registered once accepted
- [ ] The Hub publishes the registry over Mesh, signed with its identity; Nodes keep the latest valid one
- [ ] Flood Risk counts only readings from Registered Nodes
- [ ] The dashboard greys out Unverified Nodes and marks them "not counted"
- [ ] The Hub dashboard shows the Node registry
- [ ] Seam A tests: an Unverified Node pushed to High does not change Flood Risk; after registration it does; a registry not signed by the Hub is ignored
- [ ] All **Commands** pass
