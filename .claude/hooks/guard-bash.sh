#!/bin/bash
# PreToolUse hook for Bash: blocks two commands that have wasted past sessions (docs/agent-retrospectives.md).

cmd=$(jq -r '.tool_input.command // empty')

deny() {
  jq -n --arg r "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

# Playwright run by hand tests whatever was built last
if printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])playwright[[:space:]]+test'; then
  deny "Use npm run e2e (it builds with BASE_PATH=/ first) or npm run e2e:live. Pass Playwright options after --, e.g. npm run e2e -- --grep heatmap."
fi

# gh run list --commit returns nothing for a short hash
if printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+run[[:space:]]+list.*--commit[=[:space:]]+[0-9a-f]{4,39}([^0-9a-f]|$)'; then
  deny "gh run list --commit needs the full 40-character hash; use \$(git rev-parse HEAD)."
fi

exit 0
