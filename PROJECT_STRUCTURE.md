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
│   │   └── planFile.test.ts
│   ├── components/              # Reusable UI pieces
│   │   ├── AnnuitySection.tsx   # Annuity purchase inputs + estimated payout
│   │   ├── GettingStarted.tsx   # Checklist shown until the essentials are filled in
│   │   ├── OutcomeComparison.tsx# Two simulations side by side (used by the annuity and survivor panels)
│   │   ├── AnnuityComparison.tsx# Success rate and money left, with vs. without the annuity
│   │   ├── SurvivorComparison.tsx# Both live vs. one dies at the chosen age
│   │   ├── SurvivorSection.tsx  # Couples: "If one of you dies first" inputs
│   │   ├── ScenarioChart.tsx    # Median savings by age per scenario, de-collided end labels (wide screens)
│   │   ├── BucketChart.tsx      # Stacked balance by account type (pre-tax, Roth, taxable, cash, HSA)
│   │   ├── IncomeList.tsx       # Other income cards (amount, ages, inflation, taxable share)
│   │   ├── NumberField.tsx      # Number / percent inputs (keeps typed text; commits only valid numbers)
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
│   ├── App.tsx                  # App shell: header + tabs (#plan / #compare / #summary / #ask)
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
5. **Data stays local.** No accounts, no server. The plan lives in the browser (`localStorage` key `retirement-plan`).
   The one exception is **Ask Claude**: with the visitor's own API key, the plan is sent to api.anthropic.com
   (directly from the browser) when they ask a question.
   **Export** saves a JSON backup; **Import** restores one (older versions are upgraded, bad files are rejected
   with a reason, and Undo brings back the previous plan).
6. **Changing the plan shape:** bump `PLAN_VERSION` in `planStore.ts` and add a step to `migratePlanState`.
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

- Married filing jointly: both spouses are assumed the same age and to claim Social Security at the same age;
  each spouse's benefit is entered separately.
- Optional **survivor modeling**: one spouse dies at `survivor.firstDeathAge`. From that age the survivor keeps
  the **larger** of the two Social Security benefits, spends `survivor.spendingShare` of the couple's spending,
  pays healthcare for one person, and receives each income stream at its `survivorShare` (e.g. a 50% survivor
  pension). From the following year they file as **single** (federal and state), which usually raises the tax
  rate. Annuity purchases for couples are joint-life, so they continue in full.
- The dashboard compares the plan with and without the early death. Scenarios can set or remove it
  (`overrides.survivorDeathAge`, 0 = both live; preset "One spouse dies early" = 10 years into retirement), and
  Ask Claude's `run_what_if` accepts `survivorDeathAge` too.
- Not modeled: different spouse ages or claiming ages, spousal benefits (enter each spouse's ssa.gov estimate),
  survivor benefit reductions for early claiming.

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
