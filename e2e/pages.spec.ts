import { expect, test as base, type Page } from '@playwright/test'
import { CLAIMING_DEFAULTS, claimingAge } from '../src/seo/claimingAge'
import { FOUR_PERCENT_DEFAULTS, fourPercent } from '../src/seo/fourPercent'
import { KIDS_ACCOUNT_DEFAULTS, kidsAccount } from '../src/seo/kidsAccount'
import { MONEY_LAST_DEFAULTS, moneyLast } from '../src/seo/moneyLast'
import { RMD_DEFAULTS, rmdCalculator } from '../src/seo/rmd'
import { ROTH_DEFAULTS, rothConversion } from '../src/seo/rothConversion'
import { CALCULATORS } from '../src/utils/calculators'
import { formatUSD } from '../src/utils/format'

// Expected numbers come from the same code the pages run, with the pages' starting values, so the yearly tax update
// doesn't break these checks; a mismatch means the page shows something other than what the math says.

const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits).replace(/\.0+$/, '')}%`

/** Fails a test if the page logs an error or the browser blocks something (CSP). */
const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('pageerror', (e) => problems.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error' || /Refused|violat/i.test(m.text())) problems.push(m.text())
      })
      await use(problems)
      expect(problems).toEqual([])
    },
    { auto: true },
  ],
})

const results = (page: Page) => page.locator('section[aria-label="Results"]')
const expectBanner = (page: Page) =>
  expect(page.getByRole('note', { name: 'Disclaimer' })).toContainText('not financial, tax or legal advice')
const expectFitsScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

/** Type like a person: click, select all, type, Tab away. */
async function typeIn(page: Page, label: string, value: string) {
  await page.getByRole('textbox', { name: label, exact: true }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(value)
  await page.keyboard.press('Tab')
}

test('planner: example plan, every tab, saved plan', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByText('Educational only — not financial, tax or legal advice.').first()).toBeVisible()
  await page.getByRole('button', { name: /example/i }).first().click()
  await expect(page.getByText(/chance your money lasts/i).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('svg.recharts-surface')).toHaveCount(2, { timeout: 15_000 })
  // Each change is tested in a worker; the example plan has some that help
  await expect(page.locator('section[aria-labelledby="verdict-heading"]')).toContainText('points)', { timeout: 30_000 })
  // The example plan has low-tax years before RMDs
  await expect(page.getByRole('region', { name: 'Watch-outs' })).toContainText('Converting some pre-tax savings to Roth')
  // What-if sliders preview a change without saving it, then Apply writes it to the plan
  const whatIf = page.getByRole('region', { name: 'Play with your plan' })
  await whatIf.getByRole('slider', { name: /Retire at/ }).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(whatIf).toContainText('(was 65)')
  await expect(whatIf).toContainText('vs your plan', { timeout: 30_000 })
  await expect(page.getByRole('textbox', { name: 'Retire at' })).toHaveValue('65')
  await whatIf.getByRole('button', { name: 'Apply to my plan' }).click()
  await expect(page.getByRole('textbox', { name: 'Retire at' })).toHaveValue('67')
  await expect(whatIf).not.toContainText('(was')
  await expectFitsScreen(page)
  for (const tab of ['compare', 'summary', 'terms']) {
    await page.goto(`./#${tab}`)
    await expect(page.locator('#root')).toContainText(tab === 'terms' ? 'Disclaimer and terms of use' : /\d+%/, { timeout: 15_000 })
    await expectFitsScreen(page)
  }
  await page.reload()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('retirement-plan')!).state.plan.currentAge)).toBeGreaterThan(0)
  expect(await page.locator('footer a[target="_blank"]').count()).toBeGreaterThanOrEqual(10)
  // The logo and title go home (your plan) from any page
  await page.goto('./#compare')
  await page.getByRole('link', { name: 'Retirement Planner' }).click()
  await expect(page).toHaveURL(/#plan$/)
})

test('Roth conversion calculator', async ({ page }) => {
  const expected = rothConversion(ROTH_DEFAULTS)
  await page.goto('./roth-conversion-calculator/')
  await expectBanner(page)
  await expect(results(page)).toContainText(formatUSD(expected.extraTax))
  await expect(results(page)).toContainText(`${pct(expected.effectiveRate)} of the amount converted`)
  // "Use" fills the first bracket that still has room: then there's none left in it
  const fill = expected.fillTo.find((f) => f.amount > 0)!
  await page.getByRole('button', { name: 'Use' }).first().click()
  await expect(results(page)).toContainText(new RegExp(`Room left in the ${pct(fill.rate, 0)} bracket\\s*\\$0`))
  await typeIn(page, 'Your age this year', '66')
  await typeIn(page, 'Social Security received this year', '40000')
  await expect(results(page)).toContainText('Medicare premiums two years from now')
  await typeIn(page, 'Other taxable income this year', '75000')
  await expect(page.getByRole('textbox', { name: 'Other taxable income this year' })).toHaveValue('75,000')
  await expect(page.locator('article table')).toHaveCount(2)
  await expectFitsScreen(page)
})

test('RMD calculator', async ({ page }) => {
  const expected = rmdCalculator(RMD_DEFAULTS)
  await page.goto('./rmd-calculator/')
  await expectBanner(page)
  await expect(results(page)).toContainText(formatUSD(expected.rmd))
  await expect(results(page)).toContainText(expected.deadline)
  await expect(results(page).locator('tbody tr')).toHaveCount(expected.schedule.length)
  const later = rmdCalculator({ ...RMD_DEFAULTS, birthYear: 1962 })
  await typeIn(page, 'Year you were born', '1962')
  await expect(results(page)).toContainText(`first RMD is for ${later.firstYear}, the year you turn ${later.startAge}`)
  await expect(page.locator('article table')).toHaveCount(1)
  await expectFitsScreen(page)
})

test('big expenses: add college, see it in the results, the lever and the summary', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: /example/i }).first().click()
  // Open by default, with its add buttons showing
  await expect(page.getByRole('button', { name: 'Big expenses', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'About adding a big expense' })).toBeVisible()
  await page.getByRole('button', { name: '+ College' }).click()
  await expect(page.getByRole('combobox', { name: 'Type of college' })).toHaveValue('publicInState')
  await typeIn(page, 'Child’s age now', '15')
  await expect(page.locator('#root')).toContainText('(before you retire)')
  // Results: the big-expenses line and the "halve college" lever
  await expect(page.locator('#root')).toContainText('Big expenses:', { timeout: 30_000 })
  await expect(page.locator('section[aria-label="Results"], #root')).toContainText('Pay half of the college costs', { timeout: 30_000 })
  // "My own amount" keeps the cost and drops the preset
  await page.getByRole('combobox', { name: 'Type of college' }).selectOption('custom')
  await expect(page.getByRole('combobox', { name: 'Type of college' })).toHaveValue('custom')
  await page.goto('./#summary')
  await expect(page.locator('#root')).toContainText('College', { timeout: 15_000 })
  await expectFitsScreen(page)
})

test('heatmap: every retirement and claiming age, with its effect on the plan', async ({ page, isMobile }) => {
  // 144 simulations, twice, while other tests share the CPU
  test.setTimeout(120_000)
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: /example/i }).first().click()
  const headline = page.getByText('Chance money lasts to').first().locator('xpath=ancestor::div[1]/..')
  await expect(headline).toContainText(/\d+%/, { timeout: 30_000 })
  // Closed until asked for
  const chart = page.getByRole('grid', { name: /Chance money lasts/ })
  await expect(chart).toHaveCount(0)
  await page.getByText('Try every retirement and Social Security age').click()
  await expect(page.locator('#root')).toContainText('Select a square to compare it', { timeout: 90_000 })
  // The ⓘ explains how to read it, by tap on a phone and by keyboard elsewhere
  const tip = page.getByRole('button', { name: 'About reading this chart' })
  if (isMobile) await tip.tap()
  else await tip.focus()
  await expect(page.getByRole('tooltip')).toContainText('Each square is your chance')
  // A second tap closes it, and a third opens it again
  if (isMobile) {
    await tip.tap()
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await tip.tap()
    await expect(page.getByRole('tooltip')).toHaveCount(1)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  // A plain summary, and a way to jump to the closest combination that reaches strong
  await expect(page.locator('#root')).toContainText(/Your plan \(retire 65, claim 67\): \d+%, at risk/)
  await expect(page.locator('#root')).toContainText(/retire \d+, claim \d+ \((about|at least) \d+%\)/)
  // The limits of the numbers are stated: this grid has retirement ages before 67
  await expect(page.locator('#root')).toContainText('Retiring before 67:')
  await expect(page.locator('#root')).toContainText('could be a few points off')
  await page.getByRole('button', { name: 'Show me' }).click()
  await expect(page.locator('#root')).toContainText('to strong')
  await expect(chart.getByRole('button', { pressed: true })).toBeInViewport()
  // Your plan's cell shows the same chance as the headline
  const planCell = chart.getByRole('button', { name: /your plan/ })
  await expect(planCell).toHaveCount(1)
  await expect(planCell).toHaveAttribute('aria-label', /Retire at 65, claim at 67: \d+% chance/)
  const planPct = await planCell.innerText()
  await expect(headline).toContainText(`${planPct}%`)
  // Arrow keys move inside the chart
  await planCell.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(chart.getByRole('button', { name: /Retire at 67, claim at 67/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#root')).toContainText('vs your plan')
  // The example plan is at risk, and this combination reaches borderline
  await expect(page.locator('#root')).toContainText('This moves your plan from at risk to borderline')
  await expect(page.getByRole('textbox', { name: 'Retire at' })).toHaveValue('65')
  await page.getByRole('button', { name: 'Apply to my plan' }).click()
  await expect(page.getByRole('textbox', { name: 'Retire at' })).toHaveValue('67')
  await expect(page.locator('#root')).toContainText('Applied to your plan')
  await expect(chart.getByRole('button', { name: /your plan/ })).toHaveAttribute('aria-label', /Retire at 67, claim at 67/, { timeout: 30_000 })
  // Undo survives selecting another square, puts the ages back, and says so
  await expect(page.getByRole('button', { name: 'About undo' })).toBeVisible()
  await chart.getByRole('button', { name: /Retire at 66, claim at 67/ }).click()
  await expect(page.getByRole('button', { name: 'About undo' })).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).last().click()
  await expect(page.getByRole('textbox', { name: 'Retire at' })).toHaveValue('65')
  await expect(page.locator('#root')).toContainText('Your plan is back to how it was')
  await expect(chart.getByRole('button', { name: /your plan/ })).toHaveAttribute('aria-label', /Retire at 65, claim at 67/, { timeout: 30_000 })
  // Retyping an age takes the results away for a moment; the chart comes back open
  await typeIn(page, 'Retire at', '40')
  await expect(page.locator('#root')).toContainText('Fix these inputs')
  await expect(chart).toHaveCount(0)
  await typeIn(page, 'Retire at', '67')
  await expect(chart).toBeVisible({ timeout: 30_000 })
  await expectFitsScreen(page)
})

test('Free calculators menu lists every calculator page and opens one', async ({ page }) => {
  await page.goto('./')
  const button = page.getByRole('button', { name: /Free calculators/ })
  await button.click()
  const menu = page.locator('#calculators-menu')
  await expect(menu.getByRole('link')).toHaveCount(CALCULATORS.length)
  // The open menu stays on screen (on phones it opens from the button's left edge)
  const box = (await menu.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  // At an in-between width the button sits mid-row; the menu still fits
  const size = page.viewportSize()!
  await page.setViewportSize({ width: 560, height: size.height })
  await button.click()
  const mid = (await menu.boundingBox())!
  expect(mid.x).toBeGreaterThanOrEqual(0)
  expect(mid.x + mid.width).toBeLessThanOrEqual(561)
  await page.keyboard.press('Escape')
  await page.setViewportSize(size)
  // Opened once: no more glow
  await expect(button).not.toHaveClass(/attention/)
  // The footer has the same six as cards
  await expect(page.getByRole('navigation', { name: 'Free calculators' }).getByRole('link')).toHaveCount(CALCULATORS.length)
  await button.click()
  await menu.getByRole('link', { name: /4% rule calculator/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('4% rule calculator')
  await expectFitsScreen(page)
})

test('state picker: type to filter, pick from the list or leave with a single match', async ({ page }) => {
  await page.goto('./rmd-calculator/')
  const state = page.getByRole('combobox', { name: 'State' })
  await state.click()
  await state.fill('carolina')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['North Carolina', 'South Carolina'])
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(state).toHaveValue('South Carolina')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  // A single match is picked on leaving the field; text matching nothing goes back to the last state
  await state.fill('tex')
  await page.keyboard.press('Tab')
  await expect(state).toHaveValue('Texas')
  await state.fill('xyz')
  await expect(page.getByRole('listbox')).toContainText('No state matches')
  await page.keyboard.press('Tab')
  await expect(state).toHaveValue('Texas')
})

test('4% rule calculator', async ({ page }) => {
  const expected = fourPercent(FOUR_PERCENT_DEFAULTS)
  await page.goto('./4-percent-rule-calculator/')
  await expectBanner(page)
  await expect(results(page)).toContainText(`${formatUSD(expected.firstYear)} in the first year`)
  await expect(results(page)).toContainText(pct(expected.chanceLasts, 0))
  await expect(results(page)).toContainText(pct(expected.rateFor90, 2))
  // 25× spending at 4%
  await expect(results(page)).toContainText(formatUSD(1_000_000))
  // 7 rates × 5 lengths of retirement, with the 4% / 30-year cell outlined
  await expect(results(page).locator('tbody td')).toHaveCount(35)
  await typeIn(page, 'Withdrawal rate', '5')
  await expect(results(page)).toContainText(`${formatUSD(fourPercent({ ...FOUR_PERCENT_DEFAULTS, rate: 0.05 }).firstYear)} in the first year`)
  await expectFitsScreen(page)
})

test("Kids' investment account calculator", async ({ page }) => {
  const expected = kidsAccount(KIDS_ACCOUNT_DEFAULTS)
  await page.goto('./kids-investment-account-calculator/')
  await expectBanner(page)
  await expect(results(page)).toContainText(formatUSD(Math.round(expected.atAccess.typical)))
  await expect(results(page)).toContainText(formatUSD(Math.round(expected.atLater.typical)))
  await expect(results(page)).toContainText(formatUSD(Math.round(expected.depositAloneLater)))
  await expect(results(page).locator('tbody tr')).toHaveCount(expected.years)
  // Over the yearly limit: capped, with a note
  await typeIn(page, 'Family contributions per year', '9000')
  await expect(page.getByRole('form', { name: 'Your numbers' })).toContainText('Capped at')
  const capped = kidsAccount({ ...KIDS_ACCOUNT_DEFAULTS, family: 9000 })
  await expect(results(page)).toContainText(formatUSD(Math.round(capped.atAccess.typical)))
  await expectFitsScreen(page)
})

test('Social Security claiming age calculator', async ({ page }) => {
  const expected = claimingAge(CLAIMING_DEFAULTS)
  await page.goto('./social-security-claiming-age/')
  await expectBanner(page)
  await expect(results(page)).toContainText(`Age ${expected.best.age}`)
  await expect(results(page)).toContainText('about age 80 and 4 months')
  await expect(results(page).locator('tbody tr')).toHaveCount(9)
  // Collecting only to 75 is before every break-even, so claiming at 62 collects the most
  await typeIn(page, 'Add up benefits to age', '75')
  await expect(results(page)).toContainText('Age 62')
  await expectFitsScreen(page)
})

test('How long will my money last calculator', async ({ page }) => {
  const expected = moneyLast(MONEY_LAST_DEFAULTS)
  await page.goto('./how-long-will-my-money-last/')
  await expectBanner(page)
  await expect(results(page)).toContainText(`${Math.floor(expected.typical.years)} years`)
  await expect(results(page)).toContainText(pct(expected.simulated.chanceLasts, 0))
  await expect(results(page)).toContainText(`${formatUSD(expected.spendingThatLasts.typical)} a year`)
  await expect(results(page)).toContainText(`${formatUSD(expected.spendingThatLasts.ninetyPercent)} a year`)
  await typeIn(page, 'Yearly spending from savings', '1000')
  await expect(results(page)).toContainText('Indefinitely')
  await typeIn(page, 'Yearly spending from savings', String(MONEY_LAST_DEFAULTS.savings / 5))
  await expect(results(page)).toContainText('years short of your plan age')
  await expectFitsScreen(page)
})

test('planner guided setup: labelled steps, revisit finished steps, footer row', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  const progress = page.getByRole('list', { name: 'Setup progress' })
  await expect(progress.getByRole('listitem')).toHaveCount(5)
  await expect(progress.locator('[aria-current="step"]')).toContainText('You')
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled()
  await typeIn(page, 'Your age', '55')
  await typeIn(page, 'Retire at', '65')
  await typeIn(page, 'Plan until age', '95')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(progress.locator('[aria-current="step"]')).toContainText('State')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(progress.locator('[aria-current="step"]')).toContainText('You')
  await page.getByRole('button', { name: 'Next' }).click()
  // A finished step is a button; the current and later ones aren't
  await page.getByRole('button', { name: /Back to step 1/ }).click()
  await expect(progress.locator('[aria-current="step"]')).toContainText('You')
  await expect(page.getByRole('textbox', { name: 'Your age', exact: true })).toHaveValue('55')
  await expect(page.getByRole('button', { name: 'Skip setup' })).toBeVisible()
  await expectFitsScreen(page)
})

test('printer icon opens the print / save-as-PDF dialog', async ({ page }) => {
  // Count print-dialog requests instead of opening a real dialog
  await page.addInitScript(() => {
    ;(window as unknown as { printCalls: number }).printCalls = 0
    window.print = () => {
      ;(window as unknown as { printCalls: number }).printCalls++
    }
  })
  const printCalls = () => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)
  const icon = page.getByRole('button', { name: 'Print or save as PDF' })

  // Empty plan: opens the summary's "add your numbers" card, no dialog
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await icon.click()
  await expect(page.locator('main')).toContainText('Add your numbers to see results')
  expect(await printCalls()).toBe(0)

  // From another page: opens the summary, then the dialog once the results and chart are ready
  await page.goto('./#plan')
  await page.getByRole('button', { name: 'Explore an example plan' }).click()
  await icon.click()
  await expect(page).toHaveURL(/#summary$/)
  await expect.poll(printCalls, { timeout: 30_000 }).toBe(1)
  await expect(page.locator('.paper svg.recharts-surface')).toHaveCount(1)
  await expect(page.locator('.paper')).toContainText('Converting some pre-tax savings to Roth')

  // On the ready summary: the dialog opens straight from the click
  await icon.click()
  expect(await printCalls()).toBe(2)

  // A reload doesn't reopen it
  await page.reload()
  await expect(page.locator('.paper svg.recharts-surface')).toHaveCount(1, { timeout: 30_000 })
  expect(await printCalls()).toBe(0)

  // Leaving before the summary is ready cancels the request: coming back later doesn't print. The click and the
  // navigation happen in one script step, so the summary can't get ready in between
  await page.goto('./#plan')
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Print or save as PDF"]')!.click()
    window.location.hash = '#compare'
  })
  await expect(page).toHaveURL(/#compare$/)
  await page.goto('./#summary')
  await expect(page.locator('.paper svg.recharts-surface')).toHaveCount(1, { timeout: 30_000 })
  // A pending print would fire on the next animation frame once the chart is there; wait a few
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))))
  expect(await printCalls()).toBe(0)

  // Old #print links open the summary
  await page.goto('./#print')
  await expect(page).toHaveURL(/#summary$/)
  await expect(page.getByRole('heading', { name: 'Retirement plan summary' })).toBeVisible({ timeout: 30_000 })
})
