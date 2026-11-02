import { expect, test as base, type Page } from '@playwright/test'
import { CLAIMING_DEFAULTS, claimingAge } from '../src/seo/claimingAge'
import { FOUR_PERCENT_DEFAULTS, fourPercent } from '../src/seo/fourPercent'
import { KIDS_ACCOUNT_DEFAULTS, kidsAccount } from '../src/seo/kidsAccount'
import { MONEY_LAST_DEFAULTS, moneyLast } from '../src/seo/moneyLast'
import { RMD_DEFAULTS, rmdCalculator } from '../src/seo/rmd'
import { ROTH_DEFAULTS, rothConversion } from '../src/seo/rothConversion'
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
