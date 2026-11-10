#!/bin/bash
# Stop hook: before Claude finishes a turn, run lint and unit tests if the checkout changed during the turn (edits
# or commits) and that exact state hasn't already passed. Called with "start" by the UserPromptSubmit hook, it only
# records the state the turn began in, so work the user left unfinished isn't handed to Claude to fix.
# A failure is sent back to Claude to fix (exit 2). If the follow-up attempt still fails, Claude may stop and the
# user is warned instead, so the hook can't loop.

if ! command -v jq >/dev/null; then
  echo "check-before-stop.sh: jq not found, so lint and unit tests were not run (brew install jq)" >&2
  exit 1
fi

input=$(cat)
field() { printf '%s' "$input" | jq -r "$1"; }

# Check the checkout Claude is working in: a worktree of this project has its own folder
project=${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}
repo() { (cd "$1" 2>/dev/null && cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P); }
here=$(field '.cwd // empty')
root=$project
if [ -n "$here" ] && [ -n "$(repo "$here")" ] && [ "$(repo "$here")" = "$(repo "$project")" ]; then
  root=$(cd "$here" && git rev-parse --show-toplevel)
fi
cd "$root" || exit 0
mkdir -p .tmp

# The commit, every uncommitted and untracked change, and the installed packages
state() {
  {
    git rev-parse HEAD
    git diff HEAD --binary
    git ls-files -o --exclude-standard -z | xargs -0 shasum
    shasum node_modules/.package-lock.json
  } 2>/dev/null | shasum | cut -d' ' -f1
}

start=.tmp/stop-check.start.$(field '.session_id // "none"' | tr -cd 'A-Za-z0-9_-')
if [ "$1" = start ]; then
  state > "$start"
  find .tmp -name 'stop-check.start.*' -mtime +7 -delete 2>/dev/null
  exit 0
fi

state=$(state)
# Skip if nothing changed during the turn, or this exact state already passed
[ "$(cat "$start" 2>/dev/null)" = "$state" ] && exit 0
[ "$(cat .tmp/stop-check.pass 2>/dev/null)" = "$state" ] && exit 0

if [ ! -d node_modules ]; then
  jq -n --arg m "Lint and unit tests were not run: $PWD has no node_modules (run npm install there)." \
    '{systemMessage: $m}'
  exit 0
fi

log=.tmp/stop-check.log
{ npm run lint 2>&1; lint=$?; echo "lint exit: $lint"; npm test 2>&1; tests=$?; echo "test exit: $tests"; } > "$log"

if [ "$lint" = 0 ] && [ "$tests" = 0 ]; then
  echo "$state" > .tmp/stop-check.pass
  exit 0
fi

if [ "$(field '.stop_hook_active // false')" = true ]; then
  jq -n --arg m "Lint or unit tests still fail (lint exit $lint, test exit $tests). See .tmp/stop-check.log." \
    '{systemMessage: $m}'
  exit 0
fi

{
  echo "Lint or unit tests fail on the current changes (lint exit $lint, test exit $tests). Fix them before finishing, or say why not. Last lines of .tmp/stop-check.log:"
  tail -40 "$log"
} >&2
exit 2
