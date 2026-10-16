---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

1. Claim the ticket: set `**Owner:**` to the person you're working for and `**Status:**` to `in-progress`, on a branch named `<NNNN>-<slug>` cut from an up-to-date `main`. Commit that claim first and push it, so teammates see it.
2. Build the smallest thing that meets the acceptance criteria. Add a smoke test at the pre-agreed seam where one is cheap; don't go test-first.
3. Run the checks listed under **Commands** in `AGENTS.md` (typecheck, lint, tests) before you call it done.
4. Use /code-review against `main`.
5. Tick the acceptance criteria, set `**Status:** done`, commit, then merge into `main` and push (see **Git** in `AGENTS.md`).
