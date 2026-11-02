// Browser checks for the planner and the calculator pages, on desktop and phone browsers.
//
//   npm run e2e         build for willitlast.app (BASE_PATH=/), serve it locally with the live security headers, check
//   npm run e2e:live    check https://willitlast.app itself (after a deploy)
//
// Browsers live inside node_modules (PLAYWRIGHT_BROWSERS_PATH=0, see package.json); screenshots go to .tmp/e2e/.
// Live mode uses visible browser windows: Cloudflare's Bot Fight Mode blocks headless browsers.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium, devices, webkit } from 'playwright'

const live = process.argv.includes('--live')
const BASE = live ? 'https://willitlast.app/' : 'http://localhost:4317/'
const SHOTS = new URL('../.tmp/e2e/', import.meta.url)
mkdirSync(SHOTS, { recursive: true })

const DEVICES = live
  ? [['Chrome', chromium, { viewport: { width: 1280, height: 900 } }]]
  : [
      ['Chrome', chromium, { viewport: { width: 1280, height: 900 } }],
      ['Safari', webkit, { viewport: { width: 1280, height: 900 } }],
      ['iPhone 15', webkit, devices['iPhone 15']],
      ['iPhone SE', webkit, devices['iPhone SE']],
      ['Pixel 7', chromium, devices['Pixel 7']],
      ['Dark mode', chromium, { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }],
    ]

const fitsScreen = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
const results = (page) => page.locator('section[aria-label="Results"]').innerText()

/** Type like a person: click, select all, type, Tab away. */
async function typeIn(page, label, value) {
  await page.getByRole('textbox', { name: label }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(value)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(250)
}

const SUITES = {
  async planner(page, check) {
    await page.goto(BASE)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(1000)
    check('disclaimer banner', /For educational purposes only/.test(await page.locator('body').innerText()))
    await page.getByRole('button', { name: /example/i }).first().click()
    await page.waitForTimeout(3500)
    check('results', /\d+%/.test(await page.locator('#root').innerText()))
    check('charts', (await page.locator('svg.recharts-surface').count()) >= 2)
    check('fits screen', await fitsScreen(page))
    for (const tab of ['compare', 'summary', 'terms']) {
      await page.goto(`${BASE}#${tab}`)
      await page.waitForTimeout(1500)
      check(`#${tab}`, (await page.locator('#root').innerText()).length > 300 && (await fitsScreen(page)))
    }
    await page.reload()
    await page.waitForTimeout(800)
    check('plan saved', await page.evaluate(() => JSON.parse(localStorage.getItem('retirement-plan')).state.plan.currentAge > 0))
    check('source links', (await page.locator('footer a[target="_blank"]').count()) >= 10)
  },

  async roth(page, check) {
    await page.goto(`${BASE}roth-conversion-calculator/`)
    await page.waitForTimeout(1200)
    check('$6,000 on $50,000 at 12%', /\$6,000/.test(await results(page)) && /12% of the amount converted/.test(await results(page)))
    await page.getByRole('button', { name: 'Use' }).first().click()
    await page.waitForTimeout(300)
    check('fill 12% bracket → $0 room', /Room left in the 12% bracket\s*\$0/.test(await results(page)))
    await typeIn(page, 'Your age this year', '66')
    await typeIn(page, 'Social Security received this year', '40000')
    check('Medicare card at 66', /Medicare premiums two years/.test(await results(page)))
    await typeIn(page, 'Other taxable income this year', '75000')
    check('typing replaces the value', (await page.getByRole('textbox', { name: 'Other taxable income this year' }).inputValue()) === '75,000')
    check('tax tables', (await page.locator('article table').count()) === 2)
    check('fits screen', await fitsScreen(page))
  },

  async rmd(page, check) {
    await page.goto(`${BASE}rmd-calculator/`)
    await page.waitForTimeout(1200)
    const first = await results(page)
    check('$19,608 at 74, due Dec 31', /\$19,608/.test(first) && /December 31/.test(first))
    check('25-year table', (await page.locator('section[aria-label="Results"] tbody tr').count()) === 25)
    await typeIn(page, 'Year you were born', '1962')
    check('not yet required', /first RMD is for 2037, the year you turn 75/.test(await results(page)))
    check('life expectancy table', (await page.locator('article table').count()) === 1)
    check('fits screen', await fitsScreen(page))
  },

  async moneyLast(page, check) {
    await page.goto(`${BASE}how-long-will-my-money-last/`)
    await page.waitForTimeout(1200)
    const first = await results(page)
    check('35 years, 61% chance', /35 years, to about age 100/.test(first) && /61%/.test(first))
    check('spending that lasts', /\$54,203 a year/.test(first) && /\$36,928 a year/.test(first))
    await typeIn(page, 'Yearly spending from savings', '30000')
    check('low spending lasts indefinitely', /Indefinitely/.test(await results(page)))
    await typeIn(page, 'Yearly spending from savings', '90000')
    check('high spending falls short', /years short of your plan age/.test(await results(page)))
    check('fits screen', await fitsScreen(page))
  },
}

async function runAll() {
  let failures = 0
  for (const [deviceName, browserType, options] of DEVICES) {
    const browser = await browserType.launch({ headless: !live })
    for (const [suite, run] of Object.entries(SUITES)) {
      const page = await (await browser.newContext(options)).newPage()
      const problems = []
      page.on('pageerror', (e) => problems.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error' || /Refused|violat/i.test(m.text())) problems.push(m.text().slice(0, 160))
      })
      const failed = []
      const check = (name, ok) => ok || failed.push(name)
      try {
        await run(page, check)
      } catch (e) {
        failed.push(`crashed: ${e.message.split('\n')[0]}`)
      }
      if (problems.length) failed.push(...problems.map((p) => `browser error: ${p}`))
      await page.screenshot({ path: new URL(`${deviceName}-${suite}.png`.replace(/ /g, '_'), SHOTS).pathname })
      failures += failed.length
      console.log(`${failed.length ? '✗' : '✓'} ${deviceName.padEnd(10)} ${suite.padEnd(10)} ${failed.join('; ')}`)
      await page.context().close()
    }
    await browser.close()
  }
  return failures
}

let server
if (!live) {
  server = spawn('npx', ['vite', 'preview', '--port', '4317', '--strictPort'], { env: { ...process.env, BASE_PATH: '/' }, stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) break
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
}
try {
  const failures = await runAll()
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
  process.exitCode = failures ? 1 : 0
} finally {
  server?.kill()
}
