# Agent retrospectives

What slowed each working session down and what would help next time, newest first.

## 2026-11-10: "Enter a number" for letters, then a review of the Nov 9 work before pushing it (a664cba..)

1. **What was difficult to find?** Nothing: the "Minimum 0" text led straight to `src/components/NumberField.tsx`,
   and the review named a file and line for each finding.
2. **What documentation was missing?** Nothing said why working years record no income for Medicare surcharges. A
   review finding "fixed" that, and the example plan then showed a surcharge at 65 that stopping work normally
   avoids (form SSA-44). The reason is now in the code and the debt list.
3. **Which files required excessive exploration?** `src/engine/projection.ts` again: the credit for withheld months
   sat there as a multiplier on a total, which is why it broke for widows and spousal top-ups. It now goes into
   `socialSecurityByPerson` as the claiming age each amount is figured at.
4. **What caused unnecessary work?** Two sessions of uncommitted work meant the review covered 34 files at once.
5. **What improvement would save the most time next session?** Commit each session's work, and run the review before
   the next one starts. Still open: whether number fields should block letters as they are typed, and the three new
   entries in the debt list.

## 2026-11-10: Working-style sections in CLAUDE.md, a Fable 5.2 migration list and a skill check (no commits)

1. **What was difficult to find?** Nothing in the repo: every model call is in `src/ai/`, as `PROJECT_STRUCTURE.md`
   says. The slow part was the facts about Fable 5.2. The bundled `claude-api` reference stopped at Fable 5.1, so they
   came from Anthropic's live guide (platform.claude.com/docs/en/models/fable-5-2/migration-guide), which has a
   section for moving from Opus 5.5.
2. **What documentation was missing?** Nothing says the three working-style sections at the end of CLAUDE.md are also
   in `~/.claude/CLAUDE.md` on this Mac. That is on purpose: the project copy is the one a cloud session or another
   computer reads.
3. **Which files required excessive exploration?** None.
4. **What caused unnecessary work?** Four prompts arrived as bare pastes, so what to do with each had to be inferred:
   standing instructions went into CLAUDE.md, and the two one-off tasks (migration, skill check) were run read-only.
5. **What improvement would save the most time next session?** Don't reopen the model question: the user decided on
   2026-11-10 to keep Ask Claude on `claude-opus-5-5` and not move it to Fable 5.2. If it comes back, the change is
   one line in `src/ai/prompt.ts` plus one in `PROJECT_STRUCTURE.md`, and the points to settle first are the price
   (twice Opus 5.5's), the refusal fallback and what to show an account without 30-day retention.

## 2026-11-09: Hook review fixes, then the ten items on the debt list (4e59e39..)

1. **What was difficult to find?** Why the heatmap test sometimes failed on Undo. It took about 70 runs of that test to see
   it once: Undo was still on screen and the grid still calculating, so the click had landed elsewhere. Text above the
   button changes length when numbers arrive, and Safari doesn't hold the page still for that. A first theory (a race
   in the `<details>` toggle) was written into the code and the docs before it was tested, then removed.
2. **What documentation was missing?** Nothing said the hooks need `jq`, what the stop check counts as a change, or that
   `fill()` in the installed Firefox changes a field without the page hearing about it. CLAUDE.md now says all three.
3. **Which files required excessive exploration?** `src/engine/projection.ts` (now about 650 lines): Roth earnings and
   Social Security while working each touched the withdrawal helper, both tax loops and the yearly growth step.
4. **What caused unnecessary work?** The first Bash guard matched its phrases anywhere in a command and the first stop
   check ignored commits, so both were rewritten. A check that Undo "doesn't move" was written against the whole page,
   failed for reasons outside the heatmap, and was rewritten twice. Each repeat of the heatmap test under load took four
   to six minutes.
5. **What improvement would save the most time next session?** Steady heights for the results above the heatmap (see
   the debt list), which would remove the last known cause of lost clicks. Before explaining a flaky test in code or
   docs, reproduce it once with a screenshot. Splitting `simulatePath` by step would make the next engine change smaller.

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
