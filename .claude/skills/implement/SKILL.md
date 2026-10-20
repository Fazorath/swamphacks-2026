---
name: implement
description: "Implement one GitHub issue, from claiming it to a ready-for-review pull request."
disable-model-invocation: true
---

Implement the GitHub issue the user names (`/implement 42`). One issue per session. Tracker rules: `docs/agents/issue-tracker.md`.

1. **Read before touching anything.** `gh issue view <N> --comments`: the acceptance criteria, the spec it links (read it) and its parent. Read its blockers from GitHub, not the body: `gh api 'repos/{owner}/{repo}/issues/<N>/dependencies/blocked_by' --jq '.[] | select(.state == "open") | "#\(.number) \(.title)"'` lists the ones still open. If that prints anything, or someone else is assigned, stop and tell the user. Read the lessons for the area you will touch (`node/`, `dashboard/`, `scripts/` or `pi/` `AGENTS.md`), and `CONTEXT.md` for its words.
2. **Claim it where everyone can see.**
   - `gh issue edit <N> --add-assignee @me`
   - Work in your own worktree, never in a checkout another session uses: if this session is not already in one, enter a worktree named `<N>-<slug>` (Claude Code's worktree tool, or `git worktree add ../<repo>-<N> origin/main`).
   - `git fetch origin main` and start the branch from `origin/main`. The branch on GitHub is `<N>-<slug>`: push with `git push -u origin HEAD:<N>-<slug>`.
   - Make a first commit and open a **draft PR at once**: `gh pr create --draft --title "<issue title>" --body "Closes #<N>"`. The draft PR tells teammates you are on it.
3. **Build** the smallest thing that meets the acceptance criteria. Add a smoke test at the pre-agreed seam where one is cheap; don't go test-first. Push small commits as you go.
4. **Pull before you push.** Before every push, `git fetch origin main` and merge it if the branch is behind (`git merge origin/main`); a hook refuses a push from a branch behind `main`. Rerun `scripts/check.sh` after any merge that brought code in.
5. **Check.** Run `scripts/check.sh` and fix every FAIL and SKIP; paste its summary in your report. CI runs the same thing and blocks the merge if it fails.
6. **Review.** Run `/code-review` against `main`. Fix what it finds or answer it in the PR.
7. **Hand over.** Tick the acceptance criteria in the issue, add a lessons entry if something broke or surprised you, push, then `gh pr ready`. Squash-merge once CI is green and the branch is up to date with `main` (`gh pr merge --squash --delete-branch`), unless the user wants a teammate to look first.
