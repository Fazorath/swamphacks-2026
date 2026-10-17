# 0003: Readings shared between Nodes (in-memory mesh)

**What to build:** Community Readings produced on one Node appear on every other Node's API and dashboard. This ticket adds the Mesh module's interface and an in-memory implementation, so tests can start several Nodes in one process and check what each sees. Real Reticulum comes in 0004.

**Blocked by:** 0002, and the Community Reading message format in the UI design doc (owned by whoever does the UI after 0001)

**Status:** in-progress

**Owner:** refloow-0

**Spec:** `docs/specs/storm-shield.md`

- [x] Mesh offers publish-a-message and subscribe-to-messages, and hands subscribers the sender identity
- [x] The in-memory Mesh connects several Node instances inside one test process
- [x] Community Readings follow the format from the UI design doc
- [x] Each Node's Reading store keeps the latest Community Readings per Node, with timestamps
- [x] The API and dashboard show readings from other Nodes as well as this Node's own
- [x] Seam A test setup: a reusable way to start N Nodes on the in-memory Mesh and drive them through their APIs
- [x] Seam A tests: a reading stepped on Node A shows up on Node B; removing a Node leaves the others working
- [x] All **Commands** pass
