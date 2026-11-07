/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import { PAGES, taxYearPages } from './build/taxYearPages.ts'

// `base` is the path the site is served from: '/retirement/' (the repo name) for
// https://<user>.github.io/retirement/, or BASE_PATH=/ for its own domain (willitlast.app).
// An unset or empty BASE_PATH falls back to '/retirement/'; a trailing slash is added if missing.
const basePath = process.env.BASE_PATH || '/retirement/'

// The live site's site-wide security headers (public/_headers), applied to `npm run preview` so CSP problems show up locally.
// Preview is plain http, so the HTTPS-only parts (HSTS, upgrade-insecure-requests) are left out.
// Not applied to `npm run dev`, whose hot reload needs inline scripts.
const previewHeaders = Object.fromEntries(
  readFileSync(new URL('./public/_headers', import.meta.url), 'utf8')
    // Only the site-wide "/*" rules: the lines indented under it, up to the next path
    .split(/^\/\*$/m)[1]
    .split(/^\S/m)[0]
    .split('\n')
    .filter((line) => /^\s+\S+:/.test(line))
    .map((line) => {
      const i = line.indexOf(':')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/;\s*upgrade-insecure-requests/, '')]
    })
    .filter(([name]) => name !== 'Strict-Transport-Security'),
)

// Stands in for the Worker's /api/love (src/worker/index.ts) under `npm run dev` and `npm run preview`
function loveStub(): Plugin {
  let count = 0
  const handler: Connect.NextHandleFunction = async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    if (req.method === 'POST') count = Math.max(0, count + (body.includes('remove') ? -1 : 1))
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ count }))
  }
  return {
    name: 'love-stub',
    configureServer: (server) => void server.middlewares.use(`${server.config.base}api/love`, handler),
    configurePreviewServer: (server) => void server.middlewares.use(`${server.config.base}api/love`, handler),
  }
}

export default defineConfig({
  base: basePath.endsWith('/') ? basePath : `${basePath}/`,
  plugins: [react(), tailwindcss(), taxYearPages(), loveStub()],
  build: {
    rolldownOptions: {
      // Each public page is its own HTML entry (build/taxYearPages.ts lists them, for the sitemap too)
      input: Object.fromEntries(PAGES.map(([name, path]) => [name, fileURLToPath(new URL(`./${path}index.html`, import.meta.url))])),
    },
  },
  preview: { headers: previewHeaders },
  test: {
    include: ['src/**/*.test.ts'],
    // The simulation tests run thousands of markets; 5s (the default) fails them on a busy machine
    testTimeout: 20_000,
  },
})
