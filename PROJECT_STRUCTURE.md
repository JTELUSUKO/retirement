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
│   │   │   └── 2026.ts          # Yearly US limits/rules (401k, IRA, HSA, SS, RMD). Update each January.
│   │   ├── types.ts             # Plan, Account, YearResult, ProjectionResult
│   │   ├── projection.ts        # Year-by-year simulation (simulatePath) + average-return projection
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
│   ├── store/
│   │   └── planStore.ts         # Zustand store: the user's plan + localStorage persistence
│   ├── components/              # Reusable UI pieces
│   │   ├── NumberField.tsx      # Number / percent inputs (keeps typed text; commits only valid numbers)
│   │   ├── PlanForm.tsx         # All plan inputs (age, accounts, income, assumptions)
│   │   ├── ProbabilityChart.tsx # Monte Carlo bands (10–90th, 25–75th) + median line
│   │   ├── StatCard.tsx         # Headline number tiles
│   │   └── YearTable.tsx        # Year-by-year table: average returns or simulation percentiles
│   ├── pages/
│   │   └── Dashboard.tsx        # Form + results (stat cards, chart, yearly table)
│   ├── utils/
│   │   └── format.ts            # Currency formatting
│   ├── App.tsx                  # App shell (header + page)
│   ├── main.tsx                 # React entry point
│   └── index.css                # Tailwind import + chart color tokens (light/dark)
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
4. **Data stays local.** No accounts, no server. The plan lives in the browser (`localStorage` key `retirement-plan`).

## Timing rules

One row per year; the age is your age at the **start** of that year.

- **Working years:** the balance grows for the year, then that year's contributions are added at year end.
- **Retired years:** spending not covered by income is withdrawn at the start of the year, then the rest grows.
- **"Savings at retirement"** and the chart both use the balance at the start of each age.
- Amounts are entered in today's dollars and rise with inflation (the realized inflation path in simulations).

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
| 2: Realism | ✅ `engine/monteCarlo.ts`, `components/ProbabilityChart.tsx` · next: `engine/withdrawals.ts` (RMDs, drawdown order), `engine/taxes.ts`, `engine/healthcare.ts` |
| 3: Scenarios | `pages/Scenarios.tsx`, `components/ScenarioCompare.tsx`, `utils/exportImport.ts`, `pages/PrintSummary.tsx` |
| 4: AI assistant | `src/ai/` (Claude chat UI) + a small serverless function to keep the API key off the client |

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
