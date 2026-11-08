---
name: yearly-tax-update
description: Update willitlast.app's tax, contribution-limit, Medicare and Social Security figures to a new tax year. Use when asked to "update willitlast.app for <year>", to do the yearly tax update, or to work the "Update willitlast.app tax figures for <year>" GitHub issue.
---

# Yearly tax update

`YEARLY_UPDATE.md` at the repo root is the checklist and stays the single source. Read all of it first, then work
through it in order. This skill adds only how to run it.

1. **Confirm the year and what's published.** The target year is the one asked for (or the reminder issue's title).
   For each row of the "What to update" table, find the official source for that year. A figure that isn't published
   yet keeps last year's value: list it for the user rather than guessing or using a news summary.
2. **Change only `src/engine/config/taxYear.ts`** (and `config/stateRules.ts` through `scripts/`, only once the Tax
   Foundation table for the year is out). Never type a figure or a year anywhere else.
3. **Record each source.** For every figure changed, note the official URL and the page or table it came from, and
   update the year-named `sources` links, `year` and `reviewed`.
4. **Treat test failures as checks, not chores.** When `npm test` fails, compare the new expected number with the
   official source before changing the test. Say which tests changed and why.
5. **Run the release steps** in "Check and release": lint, build (no "Tax figures are for…" warning), `npm run e2e`,
   and one spot check per calculator page against the source.
6. **Stop before pushing.** A push to `main` deploys the live site. Show the user the list of changed figures with
   old value, new value and source, plus anything left on last year's value, and push only when they say so. After
   the deploy run finishes, run `npm run e2e:live` and offer to close the reminder issue.
