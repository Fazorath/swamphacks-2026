---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

1. Claim the ticket with `scripts/claim.sh <NNNN>`. It refuses a ticket someone else owns or whose blockers aren't done, pushes the claim to `main` so teammates see it, and creates the `<NNNN>-<slug>` branch from it. Work on that branch (in a worktree: `git merge origin/main`, push with `git push origin HEAD:<NNNN>-<slug>`). If it refuses, stop and tell the user why; never claim by editing the ticket yourself.
2. Build the smallest thing that meets the acceptance criteria. Add a smoke test at the pre-agreed seam where one is cheap; don't go test-first.
3. Run `scripts/check.sh` and fix every FAIL and SKIP before you call it done; paste its summary in your report. If the Reticulum tests say ports are taken, run `scripts/stop-nodes.sh` and rerun.
4. Use /code-review against `main`.
5. Tick the acceptance criteria, set `**Status:** done`, commit, then `git fetch && git merge origin/main`, run `scripts/check.sh` again if that brought anything in, merge into `main` and push (see **Git** in `AGENTS.md`).
