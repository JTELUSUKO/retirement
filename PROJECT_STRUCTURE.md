# Project Structure

Retirement Planner is a single-page web app built with **Vite + React + TypeScript**.
All calculations run in the browser and plans are saved to `localStorage`, so there is no backend.
It is hosted on **GitHub Pages** and deployed automatically on every push to `main`.

```
retirement/
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI: install → test → build → publish to GitHub Pages
├── public/
│   └── favicon.svg              # Static files copied as-is into the build
├── src/
│   ├── engine/                  # Pure calculation code. No React, no browser APIs.
│   │   ├── config/
│   │   │   ├── 2026.ts          # Yearly US rules: limits, SS, RMD table, federal tax brackets/deductions. Update each January.
│   │   │   └── stateTax2026.ts  # GENERATED from the Tax Foundation 2026 table (41 states + DC); regenerate, don't hand-edit
│   │   ├── types.ts             # Plan, Account, YearResult, ProjectionResult
│   │   ├── projection.ts        # Year-by-year simulation per account (simulatePath) + average-return projection
│   │   ├── accounts.ts          # Account type → tax bucket, withdrawal order, proportional withdrawals
│   │   ├── accounts.test.ts
│   │   ├── rmd.ts               # RMD start age (73/75) + Uniform Lifetime Table
│   │   ├── rmd.test.ts
│   │   ├── taxes.ts             # Federal income tax + taxable Social Security
│   │   ├── taxes.test.ts
│   │   ├── returns.ts           # Median (typical) return from average return + volatility
│   │   ├── irmaa.ts             # Medicare income surcharges (CMS 2026 tiers)
│   │   ├── longTermCare.ts      # Optional long-term care cost period (and stress-test defaults)
│   │   ├── safeSpending.ts      # "How much can I safely spend?" (bisection over the Monte Carlo)
│   │   ├── phaseC.test.ts       # Fees/mix, spousal benefits, long-term care, safe spending
│   │   ├── phaseB.test.ts       # IRMAA and Roth conversion tests
│   │   ├── contributions.ts     # 2026 IRS contribution-limit warnings (401(k), IRA, HSA; age catch-ups)
│   │   ├── phaseA.test.ts       # Typical returns, early-withdrawal penalty, capital gains/NIIT, limits
│   │   ├── stateTax.ts          # State income tax (brackets, deductions, retirement exemptions, SS)
│   │   ├── stateTax.test.ts
│   │   ├── survivor.ts          # Couples: household by age (widowed, tax status, people), Social Security
│   │   ├── survivor.test.ts
│   │   ├── healthcare.ts        # Healthcare cost by age (pre-Medicare vs Medicare, per person)
│   │   ├── healthcare.test.ts   # Also covers HSA medical-first and non-medical tax/penalty
│   │   ├── income.ts            # Other income streams (annuity, pension, work, rental) by age
│   │   ├── income.test.ts
│   │   ├── annuity.ts           # Buying an annuity: payout-rate estimate, taxable share (exclusion ratio)
│   │   ├── annuity.test.ts
│   │   ├── scenarios.ts         # Scenario overrides + stress tests (crash, high inflation) as market adjustments
│   │   ├── scenarios.test.ts
│   │   ├── evaluate.ts          # evaluatePlan: validate + projection + Monte Carlo → headline results
│   │   ├── evaluate.test.ts
│   │   ├── projection.test.ts
│   │   ├── monteCarlo.ts        # 1,000 random market histories → success rate + percentile bands
│   │   ├── monteCarlo.test.ts
│   │   ├── random.ts            # Seeded random numbers (repeatable results)
│   │   ├── validation.ts        # Input checks (age order, ranges); results hidden until valid
│   │   ├── validation.test.ts
│   │   ├── testFixtures.ts      # Shared sample plans for tests
│   │   ├── socialSecurity.ts    # Benefit adjustment for claiming at ages 62–70
│   │   ├── socialSecurity.test.ts
│   │   └── index.ts             # Public exports of the engine
│   ├── sim/                     # Simulations in background Web Workers
│   │   ├── tasks.ts             # Task types + runTask (Monte Carlo, evaluatePlan, safe spending)
│   │   ├── simulation.worker.ts # Worker entry: runs one task at a time
│   │   ├── pool.ts              # Up to 4 workers; queued tasks superseded per group; main-thread fallback
│   │   ├── useSimulation.ts     # React hooks: run tasks when inputs change, keep last result while updating
│   │   └── sim.test.ts
│   ├── ai/                      # "Ask Claude" assistant (Claude API, called from the browser)
│   │   ├── chat.ts              # Streaming tool-use loop: append-only history, fallbacks, caching, errors
│   │   ├── chat.test.ts         # Loop tested with a fake fetch replaying streamed responses
│   │   ├── prompt.ts            # Model id, frozen system prompt, plan snapshot
│   │   ├── tools.ts             # Read-only tools: get_plan_results, run_what_if (run the engine locally)
│   │   ├── tools.test.ts
│   │   ├── toolNotes.ts         # Plain-language notes for tool calls shown in the chat
│   │   ├── apiKey.ts            # Visitor's own API key: sessionStorage, or localStorage if remembered
│   │   └── chatStore.ts         # In-memory conversation (not saved)
│   ├── store/
│   │   ├── planStore.ts         # Zustand store: plan, localStorage persistence + migrations, clear/example/import/undo
│   │   ├── planStore.test.ts
│   │   ├── planFile.ts          # JSON backup: export, and import with upgrade + validation
│   │   ├── uiPrefs.ts           # View preferences (Basic/Advanced, open sections), saved apart from the plan
│   │   └── planFile.test.ts
│   ├── components/              # Reusable UI pieces
│   │   ├── AnnuitySection.tsx   # Annuity purchase inputs + estimated payout
│   │   ├── GettingStarted.tsx   # Checklist shown until the essentials are filled in
│   │   ├── OutcomeComparison.tsx# Two simulations side by side (annuity, survivor, Roth conversion panels)
│   │   ├── RothConversionSection.tsx    # "Tax strategy": Roth conversion settings
│   │   ├── LongTermCareSection.tsx      # Optional long-term care need
│   │   ├── SafeSpendingPanel.tsx        # Safe spending for a target chance, with "Use this" 
│   │   ├── RothConversionComparison.tsx # With vs. without conversions, incl. lifetime tax + IRMAA, after-tax left
│   │   ├── AnnuityComparison.tsx# Success rate and money left, with vs. without the annuity
│   │   ├── SurvivorComparison.tsx# Both live vs. one dies at the chosen age
│   │   ├── SurvivorSection.tsx  # Couples: "If one of you dies first" inputs
│   │   ├── ScenarioChart.tsx    # Median savings by age per scenario, de-collided end labels (wide screens)
│   │   ├── BucketChart.tsx      # Stacked balance by account type (pre-tax, Roth, taxable, cash, HSA)
│   │   ├── IncomeList.tsx       # Other income cards (amount, ages, inflation, taxable share)
│   │   ├── NumberField.tsx      # Number / percent inputs (keeps typed text; money shows "450,000"; optional ⓘ)
│   │   ├── InfoTip.tsx          # ⓘ explanation: hover, focus or tap; Esc closes; kept inside the screen
│   │   ├── Footer.tsx           # Disclaimer, privacy statement, data sources
│   │   ├── PlanForm.tsx         # All plan inputs (age, accounts, income, assumptions)
│   │   ├── PlanToolbar.tsx      # Clear / Load example / Export / Import, Undo bar, import errors
│   │   ├── ProbabilityChart.tsx # Monte Carlo bands (10–90th, 25–75th) + median line
│   │   ├── StatCard.tsx         # Headline number tiles
│   │   ├── StateField.tsx       # State picker + how the state taxes retirees + partial exemption amount
│   │   └── YearTable.tsx        # Year-by-year table: average returns, by account type, or simulation range
│   ├── pages/
│   │   ├── Dashboard.tsx        # "My plan": form + results (stat cards, charts, yearly table)
│   │   ├── Scenarios.tsx        # "Compare scenarios": up to 3 what-ifs side by side with your plan
│   │   ├── Summary.tsx          # "Print summary": one report (results, chart, scenarios, inputs, milestones)
│   ├── utils/
│   │   ├── buckets.ts           # Account-type labels and chart colors
│   │   ├── scenarioPresets.ts   # One-click what-ifs (retire earlier/later, spend less, SS at 70, stress tests)
│   │   ├── labels.ts            # Account/income type labels + plain-language scenario descriptions
│   │   └── format.ts            # Currency formatting
│   ├── App.tsx                  # App shell: header (bold disclaimer) + tabs (#plan / #compare / #summary) + footer;
│   │                            #   Ask Claude is hidden from the menu but still opens at #ask
│   ├── main.tsx                 # React entry point
│   └── index.css                # Tailwind + dark-mode variant (off inside .paper), chart tokens, print styles
├── index.html                   # HTML entry used by Vite
├── vite.config.ts               # Vite + Tailwind + Vitest config. `base` = "/retirement/" for Pages.
├── package.json                 # Scripts: dev, build, test, lint, preview
├── PROJECT_STRUCTURE.md         # This file
└── README.md                    # What the app does + how to run it
```

## Design rules

1. **Engine stays pure.** Everything in `src/engine/` is plain TypeScript functions: input in, numbers out.
   This makes the math easy to unit-test, and later features (Monte Carlo, AI assistant) can reuse it.
2. **Yearly numbers live in one place.** Contribution limits, ages and brackets go in `engine/config/<year>.ts`,
   never hard-coded in components.
3. **Today's dollars in the UI.** Users enter amounts in today's dollars; the engine inflates them internally
   and reports both nominal and inflation-adjusted values.
4. **New visitors start blank.** Personal fields (ages, spending, Social Security, accounts, income) start empty;
   0 is shown as an empty field. Model assumptions, healthcare estimates and claiming at 67 stay filled in.
   Pages show a getting-started checklist (`missingEssentials`) until age, retirement age, plan-to age and
   spending are entered. **Load example** fills a sample plan; **Clear all** returns to blank.
5. **Public-ready form.** Basic mode (default) shows you, accounts, and spending & Social Security; Advanced adds
   the rest. Sections collapse to a one-line summary; Basic mode lists advanced settings that are still in effect.
   Explanations live in ⓘ tips rather than paragraphs. New accounts are named after their type ("401(k) 2") and
   renamed when the type changes, unless you typed a name. "Reset" returns to a blank plan (with Undo).
6. **Data stays local.** No accounts, no server. The plan lives in the browser (`localStorage` key `retirement-plan`).
   The one exception is **Ask Claude**, which is hidden from the menu (it opens only at `#ask`, marked
   experimental): with the visitor's own API key, the plan is sent to api.anthropic.com when they ask a question.
   **Export** saves a JSON backup; **Import** restores one (older versions are upgraded, bad files are rejected
   with a reason, and Undo brings back the previous plan).
7. **Changing the plan shape:** bump `PLAN_VERSION` in `planStore.ts` and add a step to `migratePlanState`.
   Both saved browser data and backup files go through the same migration.

## Timing rules

One row per year; the age is your age at the **start** of that year.

1. **RMDs** (from age 73, or 75 if born 1960+) come out of pre-tax accounts at the start of the year,
   using the start-of-year pre-tax balance and the IRS Uniform Lifetime Table. This applies even while working.
2. **Retired years:** spending (including healthcare) not covered by income is withdrawn at the start of the
   year: the RMD first, then the **HSA for healthcare costs**, then **cash → taxable → pre-tax → Roth → HSA**,
   split proportionally across accounts of the same type.
   RMD money you don't need is reinvested in a taxable account (a hidden one is created if you have none).
3. **Federal income tax** (retired years) is added to what must be withdrawn, and solved iteratively because
   pre-tax withdrawals are themselves taxable. See "How taxes work" below.
4. **Growth:** every account grows for the year. Cash earns inflation; everything else earns the market return.
5. **Working years:** contributions are added at year end. HSA contributions stop at 65 (Medicare).
- **"Savings at retirement"** and the chart both use the balance at the start of each age.
- Amounts are entered in today's dollars and rise with inflation (the realized inflation path in simulations).
- **Other income** (annuities, pensions, part-time work, rental) counts in retired years between its start and end
  ages. "Rises with inflation" amounts are in today's dollars; fixed amounts are the actual dollars paid and lose
  buying power over time. Only the taxable share is taxed.
- **Income surplus:** income beyond spending and tax is reinvested in a taxable account.
- **Buying an annuity** (at or after retirement): the premium (today's dollars, inflated to the purchase year)
  leaves pre-tax or after-tax savings at the start of the purchase year; payments start that year, for life.
  Payout = premium × payout rate (your quote, or an estimate by age; ×0.88 joint, ×0.72 inflation-adjusted).
  Pre-tax-funded payments are fully taxable; after-tax-funded ones are taxed only on the earnings part (IRS
  exclusion ratio with Table V life expectancy). No refund/period-certain options; nothing passes to heirs.
  The dashboard runs the simulation with and without it to show the trade-off.
- Birth year is estimated as current year − age (used for the RMD start age).

## How taxes work

- **Taxed as income:** pre-tax withdrawals (including the whole RMD, even the part reinvested), the taxable share of other income,
  and the taxable part of Social Security (IRS provisional-income test, up to 85%).
- **Brokerage accounts:** each tracks its cost basis (user-entered; empty = same as balance). Sales realize gains
  above basis proportionally; a 1.5% qualified-dividend yield is taxed each retirement year and reinvested (raising
  basis). Gains and dividends are taxed at 0/15/20% stacked on ordinary income (2026 thresholds $49,450 /
  $98,900 and $545,500 / $613,700), plus the 3.8% NIIT above $200k / $250k MAGI. States tax them as ordinary income.
- **Early withdrawals:** pre-tax withdrawals before 59½ owe a 10% penalty (the year you turn 59 is treated as after
  59½). Rule of 55: 401(k)s are penalty-free if you retire at 55+, and are used before penalized pre-tax money.
- **HSA:** tax-free when it pays healthcare costs. HSA money used for other spending is taxed as income,
  plus a 20% penalty before 65.
- **Not taxed:** Roth, cash, and taxable-account withdrawals
  (capital gains aren't modeled; many retirees fall in the 0% capital-gains bracket).
- **Deductions:** standard deduction, the extra 65+ deduction, and the temporary $6,000 senior deduction
  (2025–2028, phased out above $75k/$150k).
- **Filing status:** single or married filing jointly (the spouse is assumed to be the same age).
- Brackets and deductions rise with inflation; the Social Security thresholds don't (as in the law).
- **State income tax:** the plan's state (or none). Starts from federal ordinary income, removes retirement
  income in states that fully exempt it (IL; IA from 55; MS and PA from about 59) or the user's per-person
  exemption amount otherwise, adds federally taxable Social Security in the 8 states that tax it (CO, CT, MN, MT,
  NM, RI, UT, VT; their own exemptions aren't modeled), subtracts the state standard deduction and exemptions,
  applies the 2026 brackets and subtracts credits. Brackets are indexed with inflation (not all states do).
  Data: `config/stateTax2026.ts`, generated from the Tax Foundation's 2026 table.
- **Not modeled:** local/city tax, state income-based phase-outs, capital gains, IRMAA, credits, and taxes
  during working years.

## Couples and survivors

- Married filing jointly: each spouse has their own **age** (`spouseCurrentAge`), Social Security amount and
  **claiming age** (`spouseClaimAge`). The timeline runs on your age; tables show "you / spouse". You retire
  together at your retirement age, and the plan runs until the **younger** spouse reaches the plan-to age
  (`planEndAge`).
- Each benefit starts when that spouse reaches their claiming age. **Spousal top-up:** if one spouse's full
  benefit is under half of the other's, they get the difference once both have claimed, reduced if started
  before 67 (25/36% per month for 36 months, 5/12% beyond: 65% at 62); no delayed credits on the top-up. Healthcare (pre-Medicare vs. Medicare) and the
  65+ federal deductions follow each living person's own age.
- Optional **survivor modeling**: `survivor.whoDies` dies at `survivor.firstDeathAge` (their own age). The
  survivor gets the larger of their own benefit and an SSA-style **survivor benefit** (`survivor.ts`):
  - the deceased's benefit, at least 82.5% of their full benefit if they claimed early; if they died before
    claiming, their full benefit plus delayed credits earned after 67;
  - reduced if the survivor starts it before 67 (71.5% at 60);
  - started at the later of 60, the death, and the survivor's own claiming age.
  The survivor spends `survivor.spendingShare`, pays healthcare for one, receives each income stream at its
  `survivorShare`, and files **single** (federal and state) from the next year.
- The dashboard compares both living vs. the early death; scenarios (`overrides.survivorDeathAge`, 0 = both live)
  and Ask Claude (`run_what_if.survivorDeathAge`) can test other ages.
- Simplified: one household retirement date; income-stream, annuity and RMD ages use your age; full retirement age
  is 67 for both.

## Spending rules and safe spending

- **Fixed** (default): spending rises with inflation only.
- **Guardrails** (simplified Guyton–Klinger): the starting withdrawal rate (spending not covered by income ÷
  savings) is set in the first retired year with Social Security flowing. If the rate rises more than 20% above
  it, spending (not healthcare) is cut 10%, never below the floor (default 75%) and not in the plan's last 15
  years; if it falls more than 20% below, cuts are restored 10% at a time, never above the plan. Because spending
  never exceeds the plan, guardrails can only help the chance of success. The Monte Carlo reports how often a cut
  happens and the lowest spending in poor markets.
- **Safe spending:** bisection over the same seeded simulations finds the highest spending (to $500) with at
  least the target chance; "Use this" applies it. Ask Claude has the same as the `find_safe_spending` tool.

## Long-term care

- Optional: one person (couples choose who) needs care for `years` from their `startAge`, at `annualCost` per
  year in today's dollars, growing with healthcare costs and added to healthcare (HSA pays first). No cost after
  that person's death in the survivor scenario.
- The **long-term care stress test** (scenarios, Ask Claude) turns it on with the plan's settings, or $100K/yr for
  3 years from 85.

## Healthcare

- Applies only in retirement (employer coverage is assumed while working).
- Two per-person yearly costs in today's dollars: **before Medicare** (if you retire before 65) and
  **on Medicare** (65+). Married filing jointly counts two people of the same age.
- Costs rise with inflation **plus** an extra medical inflation rate (default 2%).
- "Yearly spending" excludes healthcare. Not modeled yet: IRMAA surcharges, ACA subsidies, long-term care.

## Scenarios

- A scenario stores only **overrides** of the base plan (retirement age, spending, Social Security claim age,
  annuity on/off) plus an optional **stress test**; everything else follows the base plan, including later edits.
  Setting a value back to the base plan's clears the override.
- **Stress tests** adjust every simulated year: *crash* forces a −30% return in the first retirement year;
  *high inflation* adds 3 points to inflation for the first 10 retirement years.
- Each scenario runs its own Monte Carlo; up to 3 scenarios. Scenarios are saved with the plan and in backups.
- Each scenario has a fixed color **slot** (1–3) chosen at creation, so removing one never repaints the others;
  your plan is always slot 0.

## Printable summary

- `#summary` renders a report on a "paper" that is always light (Tailwind's `dark:` variant is disabled inside
  `.paper`, and chart tokens are reset to light values), so it prints the same in any OS theme.
- **Print / Save as PDF** uses the browser's print dialog; the app header and buttons are hidden in print,
  sections avoid page breaks, and `print-color-adjust: exact` keeps chart fills and legend swatches.

## Ask Claude (Phase 4)

- **Bring your own key:** the visitor pastes an Anthropic API key, kept in `sessionStorage` (or `localStorage` if
  "remember" is ticked). The SDK runs in the browser (`dangerouslyAllowBrowser`) and calls api.anthropic.com
  directly; there is no server. Usage is billed to the visitor's key.
- **Model:** `claude-opus-5-5`, streaming, effort `medium`, server-side refusal fallback (`fallbacks: "default"`,
  beta `server-side-fallback-2026-07-01`), automatic prompt caching of the conversation.
- **Tools run locally:** `get_plan_results` and `run_what_if` call `evaluatePlan`, so every number Claude quotes
  comes from the engine. Tools are read-only; Claude can't change the plan.
- **Append-only history:** the system prompt is frozen; the plan travels as a snapshot in the user's message and
  is re-sent only when it changes. Earlier turns are never edited (required for preserved thinking, good for caching).
- The chat is kept in memory only. The SDK is lazy-loaded with the Ask page.

## Roth conversions and IRMAA

- **IRMAA:** each person 65+ pays the CMS 2026 Part B + Part D surcharge for the household's MAGI (AGI incl.
  taxable Social Security and gains) from **two years earlier**, using that year's filing status. Years before
  retirement aren't counted (salary isn't modeled). Thresholds are indexed with inflation; amounts grow with
  healthcare costs. Surcharges are part of healthcare spending (the HSA can pay them).
- **Roth conversions** (optional): in each year of the window (default retirement → the year before RMDs),
  after spending withdrawals, pre-tax money moves to a Roth account (a hidden one is created if needed) until
  taxable ordinary income reaches the top of the chosen federal bracket. The amount is solved numerically, so the
  extra Social Security that becomes taxable is accounted for. Optionally MAGI stays under the first IRMAA
  threshold from age 63. Conversion tax is paid from savings; conversions never owe the 10% penalty.
- The dashboard compares with vs. without conversions, including lifetime tax + IRMAA and money left **after tax
  on remaining pre-tax savings** (estimated at the filled bracket), since pre-tax totals overstate what's left.

## Returns

- Return inputs are **average** (arithmetic) yearly returns. The Monte Carlo draws lognormal returns with that
  average. The "typical returns" projection uses the **median** return, (1 + mean) / √(1 + σ² / (1 + mean)²) − 1,
  so it tracks the middle of the simulation instead of beating it.
- **Fees:** `annualFee` comes off invested accounts every year ((1 + return) × (1 − fee)); cash isn't charged.
- **Investment-mix presets** (100/0 … 20/80 stocks/bonds) fill return and volatility from illustrative long-run
  assumptions in `returns.ts` (stocks 8.5% / 17%, bonds 4.5% / 6%, correlation 0.1); users can override.
- Contribution limits are checked against 2026 IRS limits (warnings only; the plan uses what you enter).

## Background simulations

- Monte Carlo runs, plan evaluations (Compare, Summary) and the safe-spending search run in a pool of Web Workers
  (up to 4, one fewer than the CPU cores), so typing and clicking never wait for them. Scenario columns run in
  parallel. A newer task for the same chart replaces its queued older one; the hooks keep showing the last
  result ("Updating…") until the new one arrives.
- The typical-returns projection (about a millisecond) stays on the main thread. Ask Claude's tools also run
  on the main thread. Without Worker support (tests), tasks run directly.
- Measured in Chrome: editing spending went from a 147 ms main-thread freeze to none; opening Compare with four
  columns from 584 ms to none.

## How the Monte Carlo works

- Each run draws a random return for every year from a **lognormal** distribution, using the
  average return and volatility assumptions (separate values before and after retirement).
- Inflation is random too: it drifts around your average inflation (AR(1), persistence 0.6, yearly
  shock 1.2%), so high-inflation years cluster together like they did in the 1970s.
- A run **succeeds** if the money covers spending every year up to the planning age.
- The success rate is the share of 1,000 runs that succeed. Percentile bands show the spread of balances.
- The random seed is fixed, so results stay stable while you edit inputs.

## Data flow

```
PlanForm ──(edits)──▶ planStore (Zustand, persisted) ──▶ Dashboard
                                                          │
                                                          ▼
                    engine.validatePlan(plan) → issues? show them instead of results
                              engine.runMonteCarlo(plan) · engine.projectPlan(plan)
                                                          │
                                                          ▼
                                     StatCards · ProbabilityChart · YearTable
```

## Planned additions (by phase)

| Phase | New files |
|---|---|
| 2: Realism | ✅ Monte Carlo · ✅ per-account tracking, withdrawal order, RMDs · ✅ federal tax · ✅ healthcare + HSA · ✅ other income · ✅ annuity purchase with comparison |
| 3: Scenarios | ✅ export/import · ✅ scenario comparison + stress tests · ✅ printable summary |
| Review A | ✅ typical (median) returns · ✅ early-withdrawal penalty · ✅ capital gains/NIIT · ✅ contribution limits |
| Review B | ✅ Roth conversions (fill the bracket) · ✅ IRMAA |
| Review C | ✅ fees + investment mix · ✅ spousal benefits · ✅ long-term care · ✅ guardrails + safe spending |
| 4: AI assistant | ✅ `src/ai/` + `pages/Ask.tsx` (bring-your-own-key, no server) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server at http://localhost:5173/retirement/ |
| `npm test` | Run the engine unit tests (Vitest) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | Lint with oxlint |

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which lints, tests, builds and publishes `dist/` to GitHub Pages.
The site is served at `https://<github-username>.github.io/retirement/`.
If the repo is renamed, update `base` in `vite.config.ts` to match.
