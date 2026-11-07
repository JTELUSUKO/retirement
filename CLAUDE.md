# CLAUDE.md

Retirement planner live at https://willitlast.app: Vite, React 19, TypeScript, Zustand, Tailwind 4, Recharts.

Read the part of `PROJECT_STRUCTURE.md` you need (519 lines). Known problems are in `docs/technical-debt.md`; past
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

There's no coverage setup, and Firefox and Edge have no automated checks.

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

The shell is zsh: quote globs (an unmatched one stops the whole command), `PIPESTATUS` doesn't exist, and a failure in
an `&&` chain skips the rest. Log real exit codes for test runs.
