# Issue tracker: GitHub Issues

Work is tracked in GitHub Issues on this repo; every change reaches `main` through a pull request. Specs stay in the repo (`docs/specs/<feature>.md`), with ADRs and `CONTEXT.md`, because they are design, not tracking.

`docs/tickets/` is the frozen hackathon tracker (0001 to 0081). Read it for history; never add or edit a ticket there.

Agents use the `gh` CLI (`gh auth login` once per laptop). In a Claude Code cloud session with no `gh` login, use the GitHub MCP tools instead.

## An issue

Use a template (Feature, Bug, Review finding). Every issue has:

- **One type label:** `feature`, `bug`, `chore` or `review-finding`.
- **One area label:** `area: node`, `area: dashboard`, `area: mesh`, `area: hardware` or `area: workflow`.
- **A milestone** from `docs/roadmap.md`, or none for an idea not yet planned.
- **Acceptance criteria** as a checklist, and the spec it belongs to, if any.
- **Blockers** as GitHub's native "Blocked by" relationship, and a feature split into slices as **sub-issues** of a parent issue. Not as text.

`priority: high` means "before anything else in its milestone". `good first issue` marks small, self-contained work for newcomers.

Labels and milestones are defined in `scripts/github-labels.sh`; change them there and merge, and the "GitHub setup" workflow applies them.

## Who it is for

The GitHub assignee means "working on it now", so nobody is assigned until they start. The area label says whose queue an issue sits in; whoever writes an issue (a person or an agent, including `to-tickets`) sets it from this table.

| Kind of issue | Area label | Whose queue |
|---|---|---|
| UI: dashboard look, map, markers, panels, motion | `area: dashboard` | @Fazorath |
| Routes and evacuation algorithms; weather, forecast and Cache Pack data builds; backend rules | `area: node` | @refloow-0 |
| Breadboard, hardware, Mesh and Reticulum transport | `area: hardware`, `area: mesh` | @amitathik7 |
| Tests, workflow, scripts, miscellaneous fixes, anything that fits none of the above | `area: workflow` | @leonardorofaDV |

An issue that spans two kinds goes by the files it mostly touches. Anyone may take an issue from another queue once its owner has nothing ready of their own in the milestone.

## Starting work

1. Pick an open, unassigned issue in the current milestone, from your queue, with no open blockers. `gh issue list --milestone "<milestone>" --search "no:assignee"` or the Project board.
2. Assign yourself: `gh issue edit <N> --add-assignee @me`. An issue assigned to someone else is theirs: hands off, ask them.
3. Branch from a fresh `main` as `<N>-<slug>` (issue number, short slug) and open a **draft PR at once** with `Closes #<N>` in its body. The draft PR is how everyone sees what is being worked on and where.

The `implement` skill does steps 2 and 3 for you.

## Finishing

1. `scripts/check.sh` passes, `/code-review` against `main` is clean or answered.
2. Merge `origin/main` into the branch, push, and mark the PR ready.
3. CI must be green and the branch up to date with `main`; then squash-merge. The issue closes itself through `Closes #<N>`.

## Finding work

- This milestone: `gh issue list --milestone "M2 Cleanup"`
- Unassigned: `gh issue list --search "no:assignee"`
- Mine: `gh issue list --assignee @me`
- In flight: `gh pr list --draft`
