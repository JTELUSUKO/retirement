# Agent retrospectives

What slowed each working session down and what would help next time, newest first.

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
