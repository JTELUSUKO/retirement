import { test as base, expect, type Page } from '@playwright/test'

// The System / Light / Dark switch. Also runs in Firefox (playwright.config.ts). The device's setting is what each test
// emulates; a chosen theme must win over it. Contrast in both themes is covered by a11y.spec.ts.

/** Fails a test if the page logs an error or the browser blocks something (the CSP must allow theme-init.js). */
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

const CALCULATORS = [
  'roth-conversion-calculator/',
  'rmd-calculator/',
  'how-long-will-my-money-last/',
  '4-percent-rule-calculator/',
  'social-security-claiming-age/',
  'kids-investment-account-calculator/',
]

const option = (page: Page, name: 'System' | 'Light' | 'Dark') => page.getByRole('radio', { name, exact: true })
/** Clicks the visible icon, as a person would (the radio itself is visually hidden). */
const choose = (page: Page, name: 'System' | 'Light' | 'Dark') => page.getByTitle(name === 'System' ? 'System: match this device' : name, { exact: true }).click()

/**
 * Everything a theme change has to reach: page colors, native controls and chart colors. Compared with a test element
 * in the same browser, because browsers write Tailwind's oklch colors differently.
 */
const looks = (page: Page) =>
  page.evaluate(() => {
    const computed = (color: string) => {
      const probe = document.createElement('div')
      probe.style.color = color
      document.documentElement.append(probe)
      const value = getComputedStyle(probe).color
      probe.remove()
      return value
    }
    const body = getComputedStyle(document.body)
    const root = getComputedStyle(document.documentElement)
    return {
      background: body.backgroundColor === computed('var(--color-slate-950)') ? 'dark' : body.backgroundColor === computed('var(--color-slate-50)') ? 'light' : body.backgroundColor,
      text: body.color === computed('var(--color-slate-100)') ? 'dark' : body.color === computed('var(--color-slate-900)') ? 'light' : body.color,
      controls: root.colorScheme,
      chart: root.getPropertyValue('--chart-tooltip-bg').trim() === '#0f172a' ? 'dark' : 'light',
    }
  })
const isLight = (page: Page) => expect.poll(() => looks(page)).toEqual({ background: 'light', text: 'light', controls: 'light', chart: 'light' })
const isDark = (page: Page) => expect.poll(() => looks(page)).toEqual({ background: 'dark', text: 'dark', controls: 'dark', chart: 'dark' })

test('system: follows the device, live, with nothing saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  await expect(option(page, 'System')).toBeChecked()
  await isLight(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await isDark(page)
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
})

test('a chosen theme beats the device, and System goes back to it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  await choose(page, 'Dark')
  await isDark(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await choose(page, 'Light')
  await isLight(page)
  await choose(page, 'System')
  await isDark(page)
  expect(await page.evaluate(() => localStorage.getItem('retirement-theme'))).toBeNull()
})

test('the choice survives a reload and reaches every calculator page, which has the switch too', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  await choose(page, 'Dark')
  await page.reload()
  await expect(option(page, 'Dark')).toBeChecked()
  await isDark(page)
  for (const path of CALCULATORS) {
    await page.goto(`./${path}`)
    await expect(option(page, 'Dark')).toBeChecked()
    await isDark(page)
  }
  await choose(page, 'Light')
  await page.goto('./')
  await expect(option(page, 'Light')).toBeChecked()
  await isLight(page)
})

test('the saved theme applies before any of the app runs, so it cannot flash', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  await choose(page, 'Dark')
  // Only theme-init.js is left to apply it; the CSP is on (vite preview uses the live headers)
  await page.route('**/assets/*.js', (route) => route.abort())
  page.removeAllListeners('console')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await isDark(page)
})

test('arrow keys change the theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  await option(page, 'System').focus()
  await page.keyboard.press('ArrowRight')
  await expect(option(page, 'Light')).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(option(page, 'Dark')).toBeChecked()
  await isDark(page)
})

test('a change in one tab reaches the others', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  const other = await context.newPage()
  await other.emulateMedia({ colorScheme: 'light' })
  await other.goto('./rmd-calculator/')
  await expect(option(other, 'System')).toBeChecked()
  await choose(page, 'Dark')
  await expect(option(other, 'Dark')).toBeChecked()
  await isDark(other)
  await other.close()
})

test('the printable summary stays light under a chosen Dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  await page.getByRole('button', { name: 'Explore an example plan' }).click()
  await choose(page, 'Dark')
  await page.goto('./#summary')
  const paper = page.locator('.paper')
  await expect(paper).toBeVisible()
  expect(await paper.evaluate((el) => getComputedStyle(el).colorScheme)).toBe('light')
  expect(await paper.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
})

test('printing any page under a chosen Dark gives dark text on white', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./rmd-calculator/')
  await choose(page, 'Dark')
  await isDark(page)
  await page.emulateMedia({ media: 'print' })
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)')
  await expect.poll(async () => (await looks(page)).text).toBe('light')
  await expect(page.locator('[role="radiogroup"][aria-label="Appearance"]')).toBeHidden()
})

test('works for the session when the browser blocks storage', async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    Storage.prototype.getItem = blocked
    Storage.prototype.setItem = blocked
    Storage.prototype.removeItem = blocked
  })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./rmd-calculator/')
  await expect(option(page, 'System')).toBeChecked()
  await choose(page, 'Dark')
  await expect(option(page, 'Dark')).toBeChecked()
  await isDark(page)
})
