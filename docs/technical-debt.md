# Technical debt

Known problems not yet fixed, one entry per item. Delete an entry when it's fixed.

## Social Security estimate doesn't change with retirement age

- **Issue:** Every heatmap cell uses the plan's amount, though the ssa.gov estimate assumes earning until 67. The note under the chart now states both cases (optimistic early columns; understated later columns when the amount was already lowered), but the benefit itself is not adjusted per cell.
- **Location:** `src/utils/heatmap.ts` (`heatmapGrid`); note in `src/components/HeatmapNotes.tsx`.
- **Impact:** Early retirement columns can be optimistic by an amount the planner can't state.
- **Recommended fix:** Adjust the benefit for the years of earnings each cell removes. This needs an earnings history, or an agreed rule of thumb.

## Pay not entered: benefits before 67 are assumed withheld

- **Issue:** With no pay in the plan, Social Security that starts while still working is treated as fully withheld until 67. A spouse who isn't working has to enter 1 to avoid that.
- **Location:** `src/engine/projection.ts` (the earnings-limit block); fields in `src/components/PlanForm.tsx`.
- **Impact:** Understates plans where low pay or a non-working spouse would keep the benefit, until pay is entered.
- **Recommended fix:** A "not working" choice for the spouse, or separate retirement ages per spouse.

## A Roth with no contributions, or an amount of exactly 0, can't be entered

- **Issue:** Number fields show 0 as empty, so "Contributions so far" (and a brokerage cost basis) stores an emptied
  field as "same as balance". A Roth that is all growth or employer match has to enter 1.
- **Location:** `src/components/PlanForm.tsx` (the two cost-basis fields); `src/components/NumberField.tsx`.
- **Impact:** Left empty, such a Roth's early withdrawals are treated as tax-free.
- **Recommended fix:** Let a number field tell a typed 0 from an empty field.

## Working years don't count toward Medicare surcharges

- **Issue:** Working years record no income for the surcharge two years later, even when pay is entered. This is on
  purpose: stopping work lets you ask Social Security to use retired income (form SSA-44), but not everyone files it.
- **Location:** `src/engine/projection.ts` (`magi` in the year record).
- **Impact:** Someone with high pay who doesn't file the form pays a surcharge for up to two years that the plan omits.
- **Recommended fix:** State the assumption in the healthcare notes, or add a choice.

## The text above the heatmap keeps its tallest height

- **Issue:** `useHeldHeight` only ever raises the block's minimum height at a given width, and only re-measures when
  the chart re-renders, so a shorter takeaway leaves a blank line and a rotated phone can keep the old height.
- **Location:** `src/components/HeatmapPanel.tsx`.
- **Impact:** Cosmetic.
- **Recommended fix:** Fixed heights for the takeaway (see the Safari entry below), which would remove the hook.

## Roth five-year waits aren't modeled

- **Issue:** Converted money counts as contributions at once, and a first Roth's five-year wait on earnings is ignored.
- **Location:** `src/engine/projection.ts` (`takeRoth`, the conversion step in `drawDown`).
- **Impact:** A plan that converts and then spends that money within five years, before 59½, misses a 10% penalty.
- **Recommended fix:** Track each conversion's year.

## Edge isn't checked on this Mac, and Firefox can't emulate media

- **Issue:** Firefox now runs every spec, in the installed app (`channel: 'moz-firefox'`), because Playwright's own
  Firefox build exits with "Could not find profile folder" on this Mac (cause not found). That driver ignores
  `emulateMedia`, so printing in Firefox and a device change during a visit are still only checked by hand, and its
  `fill()` changes a field's text without the page hearing about it, so specs type instead. The Edge project runs only
  where `/Applications/Microsoft Edge.app` exists, which isn't this Mac or CI.
- **Location:** `playwright.config.ts`; `retype` in `e2e/pages.spec.ts`.
- **Impact:** Edge has still never been run against this work.
- **Recommended fix:** Install Edge here (or run the Edge project in CI), and find why Playwright's Firefox won't start.

## A tap can miss in Safari while results are arriving

- **Issue:** When numbers land, text above a button can change length and move it. Chrome and Firefox hold the page
  still for that (scroll anchoring); Safari doesn't, so a click that starts just before can land on something else and
  do nothing. This was the heatmap test's occasional failure on Undo (WebKit and phone projects), reproduced on
  2026-11-09 with Undo still showing and the grid still calculating, and it is the likely reason the click that opens the heatmap was lost twice in those runs.
- **Location:** Fixed inside the heatmap: the text above the chart keeps its tallest height (`useHeldHeight` in
  `src/components/HeatmapPanel.tsx`). Not fixed above it: the verdict and "What would help most" in
  `src/pages/Dashboard.tsx` still change height as they recalculate. The heatmap test retries those two clicks
  (`clickUntil` in `e2e/pages.spec.ts`).
- **Impact:** In Safari, a tap made in the second or two after a plan change can need repeating.
- **Recommended fix:** Give the results above the heatmap steady heights while they recalculate, then remove `clickUntil`.
