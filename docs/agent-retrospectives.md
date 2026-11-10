# Agent retrospectives

What slowed each working session down and what would help next time, newest first.

## 2026-11-09: Review fixes to the hooks and the tax skill (after 4e59e39)

1. **What was difficult to find?** Nothing in the app. The hook scripts had no tests, so each fix had to be tried by
   hand: 27 commands through the Bash guard and 14 situations through the stop check in a throwaway repo.
2. **What documentation was missing?** Nothing said the hooks need `jq`, or what the stop check counts as a change.
   CLAUDE.md now says both.
3. **Which files required excessive exploration?** None.
4. **What caused unnecessary work?** The first Bash guard matched its phrases anywhere in a command, so it blocked a
   review command that only mentioned running Playwright, and let a quoted short hash through. The first stop check
   looked only at uncommitted changes, so a commit made in the same turn was never tested.
5. **What improvement would save the most time next session?** The guard is now `guard-bash.mjs` and reads commands
   the way the shell does; the stop check compares the checkout with how the turn began (recorded by a
   `UserPromptSubmit` hook), so it covers commits and leaves the user's unfinished work alone. A small test file for
   the two hooks would let the next change to them be checked in one command.

## 2026-11-07: Theme switch, Firefox checks, heart, header promise (97885e0..76b2ec0)

Written on 2026-11-08 from the commit messages, not by the session that did the work.

1. **What was difficult to find?** Why Playwright's own Firefox exits with "Could not find profile folder" on this Mac.
   The cause is still unknown; the installed app (`channel: 'moz-firefox'`) was used instead. What deploying server
   code needs: the heart's Worker first failed with "You need a workers.dev subdomain", then needed a change on the
   Cloudflare account.
2. **What documentation was missing?** Nothing said the site is static files only, or what adding server code would
   take (Worker route, Durable Object, account settings, privacy and terms wording).
3. **Which files required excessive exploration?** Not recorded in the commits.
4. **What caused unnecessary work?** The heart: three commits (47fd75c, b2ba035, d393b1e) were added, fixed and
   reverted within 35 minutes, and the privacy text and terms changed twice and then went back. The theme spec was
   committed before it had run in Firefox, which made `npm run e2e` fail until 980e298. The header promise took two
   commits to settle on one sentence.
5. **What improvement would save the most time next session?** Before building anything that needs a server, check
   what the hosting account needs and ask first; the site is static by design. Run new browser specs in every project
   they target before committing. Hooks now run lint and unit tests before a turn ends and block running Playwright by
   hand (`.claude/settings.json`).

## 2026-11-07: Heatmap and big expenses (d2a7f4d..78f43de)

1. **What was difficult to find?** How a push reaches willitlast.app: the docs say to run Wrangler by hand, but
   `deploy.yml` already deploys on push. The real lint command also took a wrong turn through ESLint, which the project
   doesn't use.
2. **What documentation was missing?** There's no CLAUDE.md to hold the working facts: oxlint, the `BASE_PATH=/` build
   for browser checks, deploys on push, live checks in Chrome only. Firefox and Edge are build targets, but nothing says
   they have no automated checks. Twelve source files are missing from the file map, including `WhatIfPanel.tsx`,
   `WatchOuts.tsx` and `SuccessGauge.tsx`.
3. **Which files required excessive exploration?** `HeatmapPanel.tsx` (465 lines) was changed in all five heatmap
   commits and mixes the table, takeaway, selection, Undo and notes. The formula audit needed about ten engine and
   config files, with no list of which figures have an outside source.
4. **What caused unnecessary work?** Running Playwright by hand against stale or wrongly built output (twice), which
   `npm run e2e` avoids. Shell mistakes hid or skipped results: a directory passed to `wc`, `PIPESTATUS` under zsh,
   unquoted globs. A short commit hash in `gh run list --commit` returned no run, so live checks started before the
   deploy was confirmed. Coverage had to be installed temporarily because the repo has no coverage setup.
5. **What improvement would save the most time next session?** A short CLAUDE.md with the commands, deploy path and
   shell cautions above.
