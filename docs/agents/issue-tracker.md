# Issue tracker: local markdown files

No GitHub Issues. Specs and tickets are files in this repo, versioned with the code.

- **Specs:** `docs/specs/<feature-slug>.md`, one per feature.
- **Tickets:** `docs/tickets/<NNNN>-<slug>.md`, numbered repo-wide (`0001`, `0002`…). Take the next number after the highest existing file. If two people grab the same number at once, whoever merges second renumbers.

Every ticket carries these lines:

```
**Blocked by:** 0002, 0003   (or "None (can start immediately)")
**Status:** ready-for-agent | in-progress | done
**Owner:** unclaimed | <name>
**Assignee:** <git user.name of the suggested person>
**Spec:** docs/specs/<feature-slug>.md
```

## Assigning

`Assignee` says who a ticket was written for; it is a suggestion. `Owner` still means claimed, so `claim.sh` and the pre-commit claim guard are unchanged: `claim.sh` still sets `Owner` and still refuses a ticket someone else owns. Whoever writes a ticket (a person or an agent, including `to-tickets`) sets `Assignee` from this table. Anyone can re-assign by editing that one line.

| Kind of ticket | Assignee |
|---|---|
| UI: dashboard look, map, markers, panels, motion | Fazorath |
| Routes and evacuation algorithms; weather, forecast and Cache Pack data builds; backend rules | refloow-0 |
| Breadboard, hardware, Mesh and Reticulum transport | amitathik7 |
| Tests, workflow, scripts, miscellaneous fixes, anything that fits none of the above | leonardorofaDV |

A ticket that spans two kinds goes by the files it mostly touches. The handle must equal that person's `git config user.name`, or `claim.sh` will treat their own ticket as someone else's.

## Claiming

1. Pick a ticket whose status is `ready-for-agent` and whose blockers are all `done`.
2. Run `scripts/claim.sh 0004`. It checks the ticket on the latest `origin/main` (unclaimed, blockers done), sets `Owner` to your git `user.name` and `Status` to `in-progress`, pushes that straight to `main` and creates the `0004-<slug>` branch. A claim that lives only on your branch is invisible to everyone else; that is how two people claimed 0009. Post "taking 0004" in the group chat.
3. Seeing someone else's name on a ticket means hands off. `claim.sh` refuses it for you.

## Finding work

- Ready tickets: `grep -l "Status:\*\* ready-for-agent" docs/tickets/*.md`
- Everything at a glance: `scripts/ticket-status.sh` prints each ticket's status and owner with a done count. After you change a ticket's status, refresh the table in `docs/tickets/README.md` with `scripts/ticket-status.sh --markdown > docs/tickets/README.md`.
- What's in progress: `grep -H "Owner:" docs/tickets/*.md | grep -v unclaimed`

## Status vocabulary

- `ready-for-agent` — fully specified, anyone (or any agent) can pick it up.
- `in-progress` — claimed; see Owner.
- `done` — merged into `main`.
