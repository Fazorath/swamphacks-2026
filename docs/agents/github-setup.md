# GitHub settings only the owner can change

Agents can manage issues, labels, milestones and pull requests, but not these. Do them once, in this order, in the GitHub web UI. Tick them off here in a PR when done.

## 1. Organization and repo name

- [ ] Create a free organization: github.com/organizations/new → Free. Suggested name `storm-shield`. You are its Owner.
- [ ] Repo → Settings → General → Danger Zone → **Transfer** to the organization. Issues, labels, milestones, PRs, Actions and stars move with it; old URLs redirect.
- [ ] Settings → General → rename the repo to `storm-shield`. Old links and clones keep working through redirects.
- [ ] Invite the team to the org (People → Invite) and give each of them **Write** on the repo: Fazorath, refloow-0, amitathik7, leonardorofaDV. Check these are the GitHub logins; `docs/agents/issue-tracker.md` uses them.
- [ ] Everyone updates their remote: `git remote set-url origin git@github.com:storm-shield/storm-shield.git` (redirects work meanwhile).
- [ ] Update the clone URL in `README.md` and the description ("SwampHacks 2026" → a one-line pitch).

## 2. Merging

Settings → General → Pull Requests:

- [ ] Allow **squash merging** only (untick merge commits and rebase merging). Default message: pull request title and description.
- [ ] Tick **Always suggest updating pull request branches** and **Automatically delete head branches**.

## 3. Protect main

Do this after the M0 setup PR has merged, so its CI checks exist to pick. Settings → Rules → Rulesets → New branch ruleset:

- [ ] Name `main`, Enforcement **Active**, target the default branch.
- [ ] **Restrict deletions** and **Block force pushes**.
- [ ] **Require a pull request before merging**, required approvals **0**.
- [ ] **Require status checks to pass**: add `Node service` and `Dashboard` (the CI jobs), and tick **Require branches to be up to date before merging**.
- [ ] Bypass list empty, so it applies to admins too.

## 4. Project board

- [ ] Org (or your profile) → Projects → New project → **Board**, name "Storm Shield". Link it to the repo.
- [ ] Columns: Backlog, Ready, In progress, In review, Done.
- [ ] Workflows (⋯ → Workflows): turn on **Auto-add to project** (filter `is:issue,pr is:open`), **Item closed → Done**, **Pull request merged → Done**, and set new items to **Backlog**.

## 5. After the transfer

- [ ] Run the "GitHub setup" workflow once (Actions → GitHub setup → Run workflow) if the labels or milestones look wrong.
- [ ] Tell the Claude Code session the new repo name so it can attach it.
