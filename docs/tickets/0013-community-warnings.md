# 0013: Community Warnings

**What to build:** When two or more Registered Nodes report High Flood Risk, the Hub sends one signed Community Warning over the mesh. Every Viewer then sees it, labeled non-official and pointing to official sources for evacuation. The Hub dashboard shows a log of what was sent and why.

**Blocked by:** 0012, and the Community Warning format (decided, `docs/specs/wire-formats.md`)

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] The Hub issues a Community Warning when the second Registered Node goes High, naming the Nodes and the reasons
- [ ] It does not re-issue while the condition still holds
- [ ] Each warning is signed with the Hub identity; Nodes show only warnings whose signature verifies
- [ ] The dashboard shows warnings in their own style: labeled non-official, linking to official sources, never ordering evacuation
- [ ] The Hub dashboard shows the Community Warning log
- [ ] Seam A tests: exactly one warning when 2 Registered Nodes are High; none for 1 High, or for High Nodes that are Unverified; a badly signed warning is not shown
- [ ] All **Commands** pass
