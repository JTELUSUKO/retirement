# Yearly tax update

The planner and the calculator pages use one tax year's rules. Update them once a year, after mid-November, when the
next year's figures are out. A GitHub issue opens as a reminder every November 15, and `npm run build` warns from that
date until `year` in the config moves on.

GitHub pauses scheduled workflows in public repos after 60 days without commits, so the issue can fail to appear in a
quiet year. Keep a calendar reminder for November 15 as well (or re-enable the workflow under Actions).

Shortcut: ask Claude Code to "update willitlast.app for <year>".

## What to update

Everything is in **`src/engine/config/taxYear.ts`** except state taxes, which are generated (step 6).
The calculator pages' year, dates, tax tables and source links fill in from this file at build time.

| # | Figure (`TAX_CONFIG` field) | Official source | Usually published |
|---|---|---|---|
| 1 | `federalTax.brackets`, `standardDeduction`, `additionalDeduction65`, `capitalGains` | IRS Revenue Procedure for the year (search "Rev. Proc. inflation adjustments <year>") | October–November |
| 2 | `contributionLimits` (401(k), IRA, catch-ups) | IRS newsroom "401(k) limit increases… for <year>" | November |
| 3 | `contributionLimits.hsa*` | IRS Revenue Procedure for HSA limits | May (of the year before) |
| 4 | `irmaa` tiers and Part B/D surcharges | CMS "<year> Medicare Parts A & B premiums and deductibles" fact sheet (Part D table on the same page) | November |
| 5 | `federalTax.seniorDeduction` | IRS; ends after `lastYear` (2028) unless extended by law | Only when the law changes |
| 6 | State income tax (`config/stateRules.ts`, with its own `STATE_RULES_YEAR`) | Tax Foundation "State Individual Income Tax Rates and Brackets, <year>"; regenerate with `scripts/` (see `scripts/README.md`) | January–February |
| 7 | `rmd` start ages and Uniform Lifetime Table | IRS Publication 590-B | Rarely changes |
| 8 | `federalTax.niit`, `socialSecurityThresholds` | Fixed by law (not indexed) | Only when the law changes |
| 9 | `socialSecurity` claiming ages | SSA | Rarely changes |

Then, in the same file:
- set **`year`** to the new year and **`reviewed`** to today's date;
- replace the **`sources`** URLs that name a year (the Revenue Procedure, including its `short` name, the plan-limits
  news release and the CMS fact sheet) and check every other link still opens.

State rules come out later than the federal figures. Until the new Tax Foundation table is out, keep last year's state
rules: the pages label them with `STATE_RULES_YEAR` (for example "2027 federal rules and 2026 state rules") and link last
year's table. Regenerating them in January moves the label and the Tax Foundation link forward.

## Check and release

1. `npm test`: the engine tests use the config values, so expected numbers that changed need updating. Read each
   failure; don't just accept the new number.
2. `npm run lint` and `npm run build` (no "Tax figures are for…" warning once `year` is updated).
3. `npm run e2e` (its expected numbers follow the config, so it needs no edits), then look over the calculator pages'
   tax tables in a browser.
4. Spot-check one calculation per page against the official source (for example, one bracket and one IRMAA tier).
5. Commit, push (updates GitHub Pages), then `BASE_PATH=/ npm run build && npx wrangler deploy` (willitlast.app), then `npm run e2e:live`.
6. Close the reminder issue.

Text that is not a yearly figure stays as written (for example "since 2024" for Roth 401(k) RMDs). A test fails if a
tax year is typed into a page or into user-visible app text instead of using `{{YEAR}}` / `TAX_CONFIG.year` (or
`{{STATE_YEAR}}` / `STATE_RULES_YEAR` for state rules).
