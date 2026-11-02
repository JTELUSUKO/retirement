import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { TAX_CONFIG } from '../src/engine'

// Accessibility checks with axe-core (the engine behind Lighthouse's accessibility audit), against WCAG 2.2 AA, for
// every page and the states people actually see, in light and dark mode. Colour contrast is the main risk: the
// design uses greys. Runs once (Chrome project); the layout checks in pages.spec.ts cover the other devices.

const STATES: [string, (page: Page) => Promise<void>][] = [
  ['guided setup (empty plan)', async (page) => {
    await page.goto('./')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByRole('list', { name: 'Setup progress' })).toBeVisible()
  }],
  ['plan with results', async (page) => {
    await loadExample(page)
    await expect(page.locator('svg.recharts-surface')).toHaveCount(2, { timeout: 15_000 })
  }],
  ['compare scenarios', async (page) => {
    await loadExample(page)
    await page.goto('./#compare')
    // Text only the Compare page has (the plan page also says "Chance money lasts")
    await expect(page.locator('#root')).toContainText('Each scenario is your plan with a few changes', { timeout: 15_000 })
  }],
  ['summary', async (page) => {
    await loadExample(page)
    await page.goto('./#summary')
    await expect(page.locator('svg.recharts-surface')).toHaveCount(1, { timeout: 15_000 })
  }],
  ['Free calculators menu open', async (page) => {
    await page.goto('./')
    await page.getByRole('button', { name: /Free calculators/ }).click()
    await expect(page.locator('#calculators-menu')).toBeVisible()
  }],
  ['Ask Claude (API key setup)', async (page) => {
    await page.goto('./#ask')
    await expect(page.getByRole('heading', { name: 'Ask Claude about your plan' })).toBeVisible()
  }],
  ['terms', async (page) => {
    await page.goto('./#terms')
    await expect(page.locator('#root')).toContainText('Disclaimer and terms of use')
  }],
  ['Roth calculator (with Medicare and tax notes)', async (page) => {
    await page.goto('./roth-conversion-calculator/')
    await fill(page, 'Your age this year', '67')
    await fill(page, 'Social Security received this year', '30000')
    await expect(page.locator('section[aria-label="Results"]')).toContainText('Medicare premiums')
  }],
  ['RMD calculator', async (page) => {
    await page.goto('./rmd-calculator/')
    await expect(page.locator('section[aria-label="Results"]')).toContainText('required minimum distribution')
  }],
  ['RMD calculator (first RMD year note)', async (page) => {
    await page.goto('./rmd-calculator/')
    await fill(page, 'Year you were born', String(TAX_CONFIG.year - TAX_CONFIG.rmd.startAgeBorn1951to1959))
    await expect(page.locator('section[aria-label="Results"]')).toContainText('This is your first RMD')
  }],
  ['How long will my money last', async (page) => {
    await page.goto('./how-long-will-my-money-last/')
    await fill(page, 'Yearly spending from savings', '90000')
    await expect(page.locator('section[aria-label="Results"]')).toContainText('years short')
  }],
  ['4% rule calculator', async (page) => {
    await page.goto('./4-percent-rule-calculator/')
    await expect(page.locator('section[aria-label="Results"]')).toContainText('in the first year')
  }],
  ["Kids' investment account", async (page) => {
    await page.goto('./kids-investment-account-calculator/')
    await expect(page.locator('section[aria-label="Results"]')).toContainText('Left invested to age')
  }],
  ['Social Security claiming age', async (page) => {
    await page.goto('./social-security-claiming-age/')
    await expect(page.locator('section[aria-label="Results"]')).toContainText('Break-even ages')
  }],
]

async function loadExample(page: Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Explore an example plan' }).click()
}

async function fill(page: Page, label: string, value: string) {
  await page.getByRole('textbox', { name: label, exact: true }).fill(value)
  await page.keyboard.press('Tab')
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [name, open] of STATES) {
    test(`a11y ${scheme}: ${name}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'Chrome', 'colour and markup checks run once, in Chrome')
      await page.emulateMedia({ colorScheme: scheme })
      await open(page)
      await page.waitForTimeout(300)
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      // Readable report: rule, impact, and each failing element with its measured contrast
      const report = violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(' ')} — ${n.any.map((a) => a.message).join('; ') || n.failureSummary}`),
      )
      expect(report, `${scheme} · ${name}`).toEqual([])
    })
  }
}
