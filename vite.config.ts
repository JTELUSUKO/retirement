/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { CONFIG_2026 } from './src/engine/config/2026.ts'

// `base` is the path the site is served from: '/retirement/' (the repo name) for
// https://<user>.github.io/retirement/, or BASE_PATH=/ for its own domain (willitlast.app).
// An unset or empty BASE_PATH falls back to '/retirement/'; a trailing slash is added if missing.
const basePath = process.env.BASE_PATH || '/retirement/'

// The live site's security headers (public/_headers), applied to `npm run preview` so CSP problems show up locally.
// Preview is plain http, so the HTTPS-only parts (HSTS, upgrade-insecure-requests) are left out.
// Not applied to `npm run dev`, whose hot reload needs inline scripts.
const previewHeaders = Object.fromEntries(
  readFileSync(new URL('./public/_headers', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => /^\s+\S+:/.test(line))
    .map((line) => {
      const i = line.indexOf(':')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/;\s*upgrade-insecure-requests/, '')]
    })
    .filter(([name]) => name !== 'Strict-Transport-Security'),
)

// Tax tables on the calculator pages are filled in from the same 2026 figures the calculators use
const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const table = (head: string[], rows: string[][]) =>
  `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr>${head
    .map((h) => `<th class="border-b border-slate-300 py-1 pr-3 text-left font-medium dark:border-slate-700">${h}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td class="border-b border-slate-100 py-1 pr-3 tabular-nums dark:border-slate-800">${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`
function taxTables(): Plugin {
  const { brackets, standardDeduction } = CONFIG_2026.federalTax
  const range = (lower: number, upper: number) => (upper === Infinity ? `Over ${usd(lower)}` : `${usd(lower)} – ${usd(upper)}`)
  const bracketRows = brackets.single.map(([upper, rate], i) => [
    `${Math.round(rate * 100)}%`,
    range(i ? brackets.single[i - 1][0] : 0, upper),
    range(i ? brackets.married[i - 1][0] : 0, brackets.married[i][0]),
  ])
  const tiers = CONFIG_2026.irmaa
  const irmaaRows = tiers.map(([single, joint, partB, partD], i) => [
    range(i ? tiers[i - 1][0] : 0, single).replace('$0 – ', 'Up to '),
    range(i ? tiers[i - 1][1] : 0, joint).replace('$0 – ', 'Up to '),
    partB + partD === 0 ? 'None' : `${usd(Math.round((partB + partD) * 12))} / yr`,
  ])
  return {
    name: 'tax-tables',
    transformIndexHtml: (html) =>
      html
        .replace(
          '<!--BRACKETS_2026-->',
          table(['Rate', 'Single (taxable income)', 'Married filing jointly'], bracketRows) +
            `<p class="text-sm">Taxable income is income after the standard deduction: ${usd(standardDeduction.single)} single, ${usd(standardDeduction.married)} married filing jointly, plus extra amounts for those 65 and older.</p>`,
        )
        .replace(
          '<!--IRMAA_2026-->',
          table(['Single MAGI', 'Married filing jointly MAGI', 'Extra Part B + D premium'], irmaaRows) +
            '<p class="text-sm">Surcharges are per person on Medicare. The income tiers are adjusted for inflation each year.</p>',
        ),
  }
}

export default defineConfig({
  base: basePath.endsWith('/') ? basePath : `${basePath}/`,
  plugins: [react(), tailwindcss(), taxTables()],
  build: {
    rolldownOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        roth: new URL('./roth-conversion-calculator/index.html', import.meta.url).pathname,
      },
    },
  },
  preview: { headers: previewHeaders },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
