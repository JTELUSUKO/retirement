#!/bin/bash
# Stop hook: before Claude finishes a turn, run lint and unit tests if code changed since the last passing run.
# A failure is sent back to Claude to fix (exit 2). If the follow-up attempt still fails, Claude may stop and the
# user is warned instead, so the hook can't loop.

input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
mkdir -p .tmp

# Uncommitted changes outside Markdown, tracked and untracked
untracked=$(git ls-files -o --exclude-standard | grep -v '\.md$')
if git diff --quiet HEAD -- . ':(exclude)*.md' && [ -z "$untracked" ]; then
  exit 0
fi

# Skip if this exact state already passed
state=$( { git diff HEAD --binary -- . ':(exclude)*.md'; [ -n "$untracked" ] && printf '%s\n' "$untracked" | tr '\n' '\0' | xargs -0 shasum; } | shasum | cut -d' ' -f1)
[ "$(cat .tmp/stop-check.pass 2>/dev/null)" = "$state" ] && exit 0

log=.tmp/stop-check.log
{ npm run lint 2>&1; lint=$?; echo "lint exit: $lint"; npm test 2>&1; tests=$?; echo "test exit: $tests"; } > "$log"
lint=$(sed -n 's/^lint exit: //p' "$log")
tests=$(sed -n 's/^test exit: //p' "$log")

if [ "$lint" = 0 ] && [ "$tests" = 0 ]; then
  echo "$state" > .tmp/stop-check.pass
  exit 0
fi

if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = true ]; then
  jq -n --arg m "Lint or unit tests still fail (lint exit $lint, test exit $tests). See .tmp/stop-check.log." \
    '{systemMessage: $m}'
  exit 0
fi

{
  echo "Lint or unit tests fail on the current changes (lint exit $lint, test exit $tests). Fix them before finishing, or say why not. Last lines of .tmp/stop-check.log:"
  tail -40 "$log"
} >&2
exit 2
