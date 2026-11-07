# Technical debt

Known problems not yet fixed, one entry per item. Delete an entry when it's fixed.

## Benefits before retirement aren't counted

- **Issue:** Social Security only counts in retired years, so a benefit claimed while still working is missed, though the lower benefit is applied.
- **Location:** `src/engine/projection.ts`; explained in `PROJECT_STRUCTURE.md` under "Retirement and claiming age heatmap".
- **Impact:** Those heatmap cells understate the chance, so they appear as `+` floors with no verdict color.
- **Recommended fix:** Model the salary (for the earnings limit) and working-year taxes, then count the benefit and remove the floors.

## Social Security estimate doesn't change with retirement age

- **Issue:** Every heatmap cell uses the plan's amount, though the ssa.gov estimate assumes earning until 67.
- **Location:** `src/utils/heatmap.ts:50` (`heatmapGrid`); note in `src/components/HeatmapPanel.tsx:430`.
- **Impact:** Early retirement columns can be optimistic. Someone who already entered a lowered amount gets understated results in columns at 67 and later, and no note says so.
- **Recommended fix:** State the second case in the note, or adjust the benefit for the years of earnings each cell removes.

## Early-retirement note ignores a younger spouse

- **Issue:** `showsRetiringEarly` checks only your retirement age, but couples retire together.
- **Location:** `src/utils/heatmap.ts:79`.
- **Impact:** A younger spouse who stops earning before 67 gets no warning when your own age is 67 or later.
- **Recommended fix:** Also test the spouse's age at retirement, using `spouseOffset`, and word the note for couples.

## Only some heatmap numbers say "about"

- **Issue:** The closest strong combination reads "about", but other cells and comparisons show bare numbers with the same few points of sampling noise.
- **Location:** `src/components/HeatmapPanel.tsx:213`.
- **Impact:** A one or two point difference can look meaningful, and a cell near a verdict line could land on either side of it. The note under the chart is the only other caution.
- **Recommended fix:** Decide on one rule for small differences, such as not reporting gains within the noise.

## Roth withdrawals before 59½ treated as tax-free

- **Issue:** Earnings withdrawn early from a Roth aren't taxed or penalized in the model.
- **Location:** `src/engine/projection.ts:66`. The limit is stated in `PROJECT_STRUCTURE.md` ("How taxes work"), on "My plan" (`mayUseRothEarly`) and on the printed summary.
- **Impact:** Plans that retire early and rely on Roth money can look better than they are, and the percentage itself isn't adjusted.
- **Recommended fix:** Track contributions separately from earnings, and tax and penalize the earnings.

## Firefox and Edge have almost no automated checks

- **Issue:** Both are stated build targets, but Playwright runs Chrome, Safari, phone sizes and dark mode only. Firefox
  runs `e2e/theme.spec.ts` and nothing else; Edge runs nothing.
- **Location:** `playwright.config.ts:21`; `e2e:install` in `package.json:15`; targets in `PROJECT_STRUCTURE.md:513`.
- **Impact:** Most problems in Firefox are only found by hand. Edge hasn't been tested on this work.
- **Recommended fix:** Run every spec in Firefox, and add an `msedge` project.

## Verdict lines are written in several places

- **Issue:** 70 and 85 are repeated outside `verdictFor`.
- **Location:** `src/utils/levers.ts:128`, `src/pages/Scenarios.tsx:289`, `src/components/SuccessGauge.tsx:72`, `src/utils/heatmap.ts:104`.
- **Impact:** Changing a line means finding every copy, and a missed one makes a verdict and its color or icon disagree.
- **Recommended fix:** Export the two values from `levers.ts`, and use `verdictFor` in `Scenarios.tsx`.

## ssa.gov warning is written in three places

- **Issue:** The "assumes you keep earning until 67" warning has three separate wordings.
- **Location:** `src/components/PlanForm.tsx:341`, `src/components/HeatmapPanel.tsx:433`, `src/pages/Summary.tsx:476`.
- **Impact:** A correction to one can miss the others.
- **Recommended fix:** Share one short component or string.

## `HeatmapPanel.tsx` does too many jobs

- **Issue:** One 465-line file holds the table, takeaway, selection, Apply and Undo, key and notes.
- **Location:** `src/components/HeatmapPanel.tsx`.
- **Impact:** It changed in all five heatmap commits, and each wording or behavior change means reading the whole file.
- **Recommended fix:** Move the takeaway, selected-cell details and notes into their own components in the same folder.
