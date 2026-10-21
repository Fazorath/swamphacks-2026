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

## Blockers and sub-issues

A blocker is a native link, so GitHub shows it in the issue's "Relationships" sidebar, marks the issue blocked in lists and boards, and answers `is:blocked`, `is:blocking`, `blocked-by:<N>` and `blocking:<N>` in search. An issue is ready to start when it has no open blocker. Set the links by hand under "Relationships", or with `gh` (`{owner}/{repo}` is filled in from the checkout; the calls take the blocker's or child's `id`, not its number):

```sh
id() { gh api "repos/{owner}/{repo}/issues/$1" --jq .id; }
# <N> is blocked by <B>
gh api -X POST "repos/{owner}/{repo}/issues/<N>/dependencies/blocked_by" -F issue_id="$(id <B>)"
# <C> becomes a sub-issue of <P>
gh api -X POST "repos/{owner}/{repo}/issues/<P>/sub_issues" -F sub_issue_id="$(id <C>)"
# <N>'s blockers that are still open
gh api "repos/{owner}/{repo}/issues/<N>/dependencies/blocked_by" --jq '.[] | select(.state == "open") | .number'
```

Adding a link that already exists answers 422 ("already been taken") and changes nothing.

## Who it is for

The GitHub assignee means "working on it now", so nobody is assigned until they start. The area label says whose queue an issue sits in; whoever writes an issue (a person or an agent, including `to-tickets`) sets it from this table.

| Kind of issue | Area label | Whose queue |
|---|---|---|
| UI: dashboard look, map, markers, panels, motion | `area: dashboard` | @Fazorath |
| Routes and evacuation algorithms; weather, forecast and Cache Pack data builds; backend rules | `area: node` | @refloow-0 |
| Hardware, Mesh and Reticulum transport | `area: hardware`, `area: mesh` | @amitathik7 |
| Tests, workflow, scripts, miscellaneous fixes, anything that fits none of the above | `area: workflow` | @leonardorofaDV |

An issue that spans two kinds goes by the files it mostly touches. Anyone may take an issue from another queue once its owner has nothing ready of their own in the milestone.

## Starting work

1. Pick an open, unassigned issue in the current milestone, from your queue, with no open blockers. `gh issue list --milestone "<milestone>" --search "no:assignee -is:blocked"` or the Project board.
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
- Ready to start (nobody on it, nothing blocking it): `gh issue list --search "no:assignee -is:blocked"`
- Waiting on another issue: `gh issue list --search "is:blocked"`
- Mine: `gh issue list --assignee @me`
- In flight: `gh pr list --draft`
