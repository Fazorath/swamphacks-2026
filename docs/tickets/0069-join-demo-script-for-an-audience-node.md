# 0069: Join-demo script for an audience Node

**What to build:** A prepared laptop runs `scripts/join-demo.sh <hub address>` and appears on the God's Eye View as a real Node with its own name in a Nepal town. Someone turns its Wi-Fi off, the dot shows contact lost and then Stale, and when they turn it on the dot comes back.

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** leonardorofaDV

**Assignee:** leonardorofaDV

**Spec:** `docs/specs/audience-node.md` (and `docs/specs/gods-eye-view.md`)

- [x] One command starts a Sensor Node that joins the Hub's Mesh (Hub identity, pack from the Hub, Replay followed), with a name and a Nepal position taken from arguments or a small list
- [x] The Hub-side step to accept the Node into the registry is one documented command or a Hub Panel click (the registry fits about 8 Nodes: the Hub, S0 to S3 and the Pi make 6)
- [x] The script checks the Mesh path before it starts and says what to fix (firewall, wrong network), using the lessons about firewalld, Docker and the macOS firewall
- [x] It refuses to start when its ports are in use and stops cleanly on Ctrl-C, like `run-demo.sh`
- [x] A short runbook beside the script says how to prepare the laptop, how to hand it to a volunteer, and what to do if they close the lid instead (a teammate turns Wi-Fi off)
- [x] Rehearsed on loopback, with the result and what is still unproven on real Wi-Fi noted in `docs/agents/lessons.md`; never reported as a Pi or Wi-Fi check
- [x] `bash -n` and `scripts/check.sh` pass

## Scope added in the grilling (2026-10-18)

Folded into this ticket, not new tickets:

- [x] The Hub can run Wi-Fi discovery and listen for TCP clients beside its primary interface (off by default; `run-demo.sh` turns both on for the Hub), with config tests
- [x] One Docker image whose entrypoint is `join-demo.sh`, for Windows and any Docker host; on a non-host network it dials the Hub over TCP

The image was built and run on Docker Desktop (Windows) against a Hub on the same machine; the Wi-Fi discovery path and any second laptop are unproven. See `docs/agents/lessons.md` (Audience Node).
