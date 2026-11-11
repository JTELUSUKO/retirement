# CLAUDE.md

Retirement planner live at https://willitlast.app: Vite, React 19, TypeScript, Zustand, Tailwind 4, Recharts.

Read the part of `PROJECT_STRUCTURE.md` you need (556 lines). Known problems are in `docs/technical-debt.md`; past
sessions are in `docs/agent-retrospectives.md`.

## Commands

- `npm run dev`: http://localhost:5173/retirement/
- `npm run lint`: oxlint (the project doesn't use ESLint)
- `npm test`: unit tests, a few seconds
- `npm run build`: typecheck and build
- `npm run e2e`: all local browser checks, slow. Save it for the end of a change. It builds with `BASE_PATH=/` first, so
  use it instead of running Playwright by hand, which tests whatever was built last.
- `npm run e2e:live`: Chrome only, against the live site, in visible windows (Bot Fight Mode blocks headless browsers
  and curl)

There's no coverage setup. Firefox runs every spec using the installed app, so `npm run e2e` needs Firefox in
`/Applications`; in specs, type into fields (`retype`, `typeIn`) because `fill()` doesn't reach the page there. Edge runs
every spec only on a machine with Edge in `/Applications`.

## Deploying

A push to `main` runs `.github/workflows/deploy.yml`, which lints, tests, builds and deploys both sites. No manual
Wrangler step is needed. Check that the run finished before running live checks: `gh run list --commit` needs the full
hash and returns nothing for a short one.

## Code

- `src/engine/` is pure calculation with no UI. Take tax and Social Security figures from `TAX_CONFIG`
  (`src/engine/config/taxYear.ts`), never typed in.
- Verdicts come from `verdictFor` in `src/utils/levers.ts`: 85%+ strong, 70%+ borderline, judged on the rounded percentage.
- Simulations use 1,000 runs with seed 42, so a percentage can be a few points off.
- Messages can say a result scores higher, not that a choice is right for someone.

## Shell

The shell is zsh: quote globs (an unmatched one stops the whole command), quote words starting with `=` (`echo ===`
fails), `PIPESTATUS` doesn't exist, and a failure in an `&&` chain skips the rest. Log real exit codes for test runs.

## Harness

- Hooks in `.claude/settings.json` (scripts in `.claude/hooks/`) run lint and unit tests before a turn ends when files
  changed or were committed during the turn, and block running Playwright by hand or `gh run list --commit` with a short
  hash. Output of the last check is in `.tmp/stop-check.log`. The stop check needs `jq`.
- The yearly tax update has a skill, `.claude/skills/yearly-tax-update/`, that follows `YEARLY_UPDATE.md`.
- At the end of a working session, add an entry to `docs/agent-retrospectives.md`.

## Finishing the task

Don't stop while there's still work I asked for. Keep going on anything that doesn't depend on my answer.

If you hit ordinary obstacles (errors, timeouts, empty results, failing tools), diagnose them and work through them:
retry, fix the request, or try another tool. Don't stop just to offer to continue.

If something is a deliberate blocker (a file marked off-limits, access I've withheld, or a safety guardrail), leave it
alone, tell me what you found, and look for another safe way to finish.

Still ask before any risky or irreversible action.

## Progress updates

Before you start, tell me in one line what you're about to do. Give brief updates as you work. Finish with a short
recap that makes sense on its own: what you found, what you did, and what's next.

## Clear reports

Write for a smart reader who hasn't seen your work. Put the key points first. Use plain words and full sentences, and
don't use terms you made up during the task. Use bullets only for lists of separate items. Keep it concise, but include
the context needed to understand it.
