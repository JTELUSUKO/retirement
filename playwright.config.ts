import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Browser checks for every page (e2e/pages.spec.ts).
//   npm run e2e:install   one time: download the test browsers into node_modules
//   npm run e2e           build for willitlast.app (BASE_PATH=/) and check it locally, with the live security headers
//   npm run e2e:live      check https://willitlast.app after a deploy (visible browser windows: Cloudflare's
//                         Bot Fight Mode blocks headless browsers)
const live = Boolean(process.env.E2E_LIVE)
const EDGE_APP = '/Applications/Microsoft Edge.app'

export default defineConfig({
  testDir: 'e2e',
  outputDir: '.tmp/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: live ? 'https://willitlast.app/' : 'http://localhost:4317/',
    headless: !live,
    screenshot: 'only-on-failure',
  },
  projects: live
    ? [{ name: 'Chrome', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'Chrome', use: { ...devices['Desktop Chrome'] } },
        { name: 'Safari', use: { ...devices['Desktop Safari'] } },
        { name: 'iPhone 15', use: { ...devices['iPhone 15'] } },
        { name: 'iPhone SE', use: { ...devices['iPhone SE'] } },
        { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
        { name: 'Dark mode', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
        // The installed Firefox app (Playwright's own build won't start on this Mac; docs/technical-debt.md). Its driver
        // ignores emulateMedia, so the device's setting is a preference: 1 light, 0 dark. The light device runs every
        // spec; the dark one only the theme switch, which is all that depends on it.
        ...([['Firefox', 1, undefined], ['Firefox, dark device', 0, 'theme.spec.ts']] as const).map(([name, device, testMatch]) => ({
          name,
          testMatch,
          use: {
            ...devices['Desktop Firefox'],
            channel: 'moz-firefox',
            launchOptions: { firefoxUserPrefs: { 'layout.css.prefers-color-scheme.content-override': device } },
          },
        })),
        // The installed Edge app, on machines that have it
        ...(existsSync(EDGE_APP) ? [{ name: 'Edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }] : []),
      ],
  webServer: live
    ? undefined
    : {
        command: 'npx vite preview --port 4317 --strictPort',
        url: 'http://localhost:4317/',
        env: { BASE_PATH: '/' },
        // A leftover server on the port fails the run instead of being tested by mistake
        reuseExistingServer: false,
        timeout: 30_000,
      },
})
