#!/usr/bin/env bash
# Live ticket board: fetches origin/main every few seconds and redraws each ticket's status and
# owner, so a teammate's claim shows up without a `git pull`. Ctrl-C quits.
#   scripts/ticket-watch.sh        refresh every 5 s
#   scripts/ticket-watch.sh 2      refresh every 2 s
# Reads origin/main, not your checkout; a claim that is only on a branch is not shown (that is
# the point of claiming on main). One-shot table of your own checkout: scripts/ticket-status.sh.
set -euo pipefail

interval="${1:-5}"
cd "$(dirname "$0")/.."

if [ -t 1 ]; then
  red=$'\e[31m'; green=$'\e[32m'; yellow=$'\e[33m'; dim=$'\e[2m'; bold=$'\e[1m'; reset=$'\e[0m'
else
  red=""; green=""; yellow=""; dim=""; bold=""; reset=""
fi

field() {
  sed -n "s/^\*\*$1:\*\* *//p" | head -n 1
}

trap 'printf "\n"; exit 0' INT

while true; do
  if git fetch -q origin main 2>/dev/null; then
    fetched="fetched $(date +%H:%M:%S)"
  else
    fetched="${red}fetch failed (offline?), showing the last origin/main we have${reset}"
  fi

  total=0
  done_count=0
  rows=""
  while IFS= read -r path; do
    ticket="$(git show "origin/main:$path")"
    name="$(basename "$path" .md)"
    # A status can carry a note after the keyword ("in-progress (waiting on Pis)").
    status="$(field Status <<<"$ticket")"
    status="${status%% *}"
    owner="$(field Owner <<<"$ticket")"
    total=$((total + 1))
    case "$status" in
      done) done_count=$((done_count + 1)); colour="$dim" ;;
      in-progress) colour="$yellow" ;;
      ready-for-agent) colour="$green" ;;
      *) colour="$red" ;;
    esac
    rows+="$(printf '%s%-52s %-16s %s%s' "$colour" "$name" "$status" "$owner" "$reset")"$'\n'
  done < <(git ls-tree --name-only origin/main docs/tickets/ | grep -E '/[0-9]{4}-.*\.md$')

  [ -t 1 ] && clear
  printf '%sStorm Shield tickets on origin/main%s  (%s, every %ss)\n\n' "$bold" "$reset" "$fetched" "$interval"
  printf '%s\n%s%d of %d done%s\n' "$rows" "$bold" "$done_count" "$total" "$reset"
  sleep "$interval"
done
