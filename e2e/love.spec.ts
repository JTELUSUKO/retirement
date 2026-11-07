import { test as base, expect, type Page } from '@playwright/test'

// The heart in the planner's header. Taps go to a fake server, so `npm run e2e:live` never changes the real total;
// src/worker/index.test.ts covers the real counter.

const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('pageerror', (e) => problems.push(e.message))
      await use(problems)
      expect(problems).toEqual([])
    },
    { auto: true },
  ],
})

const heart = (page: Page) => page.getByRole('button', { name: /^Love this app/ })

/** A fake /api/love starting at `start`; returns the actions it received. */
async function fakeServer(page: Page, start: number) {
  const actions: string[] = []
  let count = start
  await page.route('**/api/love', async (route) => {
    if (route.request().method() === 'POST') {
      const { action } = route.request().postDataJSON() as { action: string }
      actions.push(action)
      count += action === 'add' ? 1 : -1
    }
    await route.fulfill({ json: { count } })
  })
  return actions
}

test('shows the total, counts a tap once, remembers it, and a second tap takes it back', async ({ page }) => {
  const actions = await fakeServer(page, 1233)
  await page.goto('./')
  await expect(heart(page)).toHaveText('1,233')
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')

  await heart(page).click()
  await expect(heart(page)).toHaveText('1,234')
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect(heart(page)).toHaveText('1,234')
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')

  await heart(page).click()
  await expect(heart(page)).toHaveText('1,233')
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')
  expect(actions).toEqual(['add', 'remove'])
})

// Reads only. pages.spec.ts forgives WebKit's "access control checks" error for this address because a reload can cause it;
// here nothing interrupts the request, so a real block (the CSP, say) fails this test in every browser.
test('the real request gets a total back', async ({ page }) => {
  await page.goto('./')
  await expect(heart(page)).toHaveText(/^\d/)
})

test('a slow first answer does not replace the newer total from a tap', async ({ page }) => {
  let answerFirstRead = () => {}
  await page.route('**/api/love', async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ json: { count: 11 } })
    await new Promise<void>((resolve) => (answerFirstRead = resolve))
    await route.fulfill({ json: { count: 10 } })
  })
  const read = page.waitForResponse((r) => r.url().endsWith('/api/love') && r.request().method() === 'GET')
  await page.goto('./')
  await heart(page).click()
  await expect(heart(page)).toHaveText('11')
  answerFirstRead()
  await read
  await expect(heart(page)).toHaveText('11')
})

test('a tap in another tab updates this one, so it cannot be counted twice', async ({ page, context }) => {
  const actions = await fakeServer(page, 5)
  await page.goto('./')
  const other = await context.newPage()
  const otherActions = await fakeServer(other, 5)
  await other.goto('./')
  await expect(heart(other)).toHaveAttribute('aria-pressed', 'false')
  await heart(page).click()
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(heart(other)).toHaveAttribute('aria-pressed', 'true')
  await heart(other).click()
  await expect(heart(other)).toHaveAttribute('aria-pressed', 'false')
  expect(actions).toEqual(['add'])
  expect(otherActions).toEqual(['remove'])
  await other.close()
})

test('keeps keyboard focus through a tap', async ({ page }) => {
  await fakeServer(page, 1)
  await page.goto('./')
  await heart(page).focus()
  await page.keyboard.press('Enter')
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(heart(page)).toBeFocused()
})

test('sends nothing about the plan: only the action, and no cookies', async ({ page }) => {
  await fakeServer(page, 0)
  await page.goto('./')
  await page.getByRole('button', { name: 'Explore an example plan' }).click()
  const sent = page.waitForRequest((r) => r.url().endsWith('/api/love') && r.method() === 'POST')
  await heart(page).click()
  const request = await sent
  expect(request.postData()).toBe('{"action":"add"}')
  expect((await request.allHeaders()).cookie).toBeUndefined()
})

test('with the server down the page still works and the tap changes nothing', async ({ page }) => {
  await page.route('**/api/love', (route) => route.abort())
  await page.goto('./')
  await expect(heart(page)).toHaveText('')
  await heart(page).click()
  await expect(heart(page)).toBeEnabled()
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')
})

test('when the rate limit answers, the tap changes nothing', async ({ page }) => {
  await page.route('**/api/love', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 429, json: { error: 'Too many requests' } }) : route.fulfill({ json: { count: 7 } }),
  )
  await page.goto('./')
  await expect(heart(page)).toHaveText('7')
  await heart(page).click()
  await expect(heart(page)).toBeEnabled()
  await expect(heart(page)).toHaveText('7')
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')
})

test('calculator pages make no request to the counter', async ({ page }) => {
  let asked = false
  await page.route('**/api/love', (route) => {
    asked = true
    return route.abort()
  })
  await page.goto('./rmd-calculator/')
  await expect(page.locator('section[aria-label="Results"]')).toBeVisible()
  expect(asked).toBe(false)
})
