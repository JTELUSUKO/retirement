import { execFileSync } from 'node:child_process'
import type { Plugin } from 'vite'
import { STATE_RULES_YEAR } from '../src/engine/config/stateRules.ts'
import { SCROLL_REGION } from '../src/components/styles.ts'
import { REVIEWED_DATE, TAX_CONFIG } from '../src/engine/config/taxYear.ts'

// Fills the HTML pages from the tax-year config at build time, so a yearly update is one file
// (src/engine/config/taxYear.ts). In the HTML:
//   {{YEAR}} {{PREV_YEAR}} {{NEXT_YEAR}} {{STATE_YEAR}} {{REVIEWED}} {{REV_PROC}}
//   {{SENIOR_AMOUNT}} {{SENIOR_YEARS}} {{SENIOR_START_SINGLE}} {{SENIOR_START_JOINT}} {{LOGO}}
//   <!--BRACKETS--> <!--IRMAA_TIERS--> <!--UNIFORM_TABLE-->          tax tables
//   <!--SOURCE key: what it covers-->                                one linked source (key in TAX_CONFIG.sources)
// The build fails if a token is misspelled or a source key doesn't exist. It also writes sitemap.xml and warns when
// the next year's figures are due.

/** Every public page: [build input name, path under the site root] */
export const PAGES: [string, string][] = [
  ['main', ''],
  ['roth', 'roth-conversion-calculator/'],
  ['rmd', 'rmd-calculator/'],
  ['moneyLast', 'how-long-will-my-money-last/'],
]

const SITE = 'https://willitlast.app/'
const Y = TAX_CONFIG.year
const T = TAX_CONFIG.federalTax

const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Focusable (tabindex) so keyboard users can scroll it sideways on a phone. These pages have no script to check
// whether the table overflows, so the region is always focusable.
const table = (head: string[], rows: string[][], label: string) =>
  `<div class="overflow-x-auto ${SCROLL_REGION}" tabindex="0" role="region" aria-label="${escapeHtml(label)}"><table class="w-full text-sm"><thead><tr>${head
    .map((h) => `<th class="border-b border-slate-300 py-1 pr-3 text-left font-medium dark:border-slate-700">${h}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td class="border-b border-slate-100 py-1 pr-3 tabular-nums dark:border-slate-800">${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`
const range = (lower: number, upper: number) => (upper === Infinity ? `Over ${usd(lower)}` : `${usd(lower)} – ${usd(upper)}`)

function bracketsTable(): string {
  const { brackets, standardDeduction } = T
  const rows = brackets.single.map(([upper, rate], i) => [
    `${Math.round(rate * 100)}%`,
    range(i ? brackets.single[i - 1][0] : 0, upper),
    range(i ? brackets.married[i - 1][0] : 0, brackets.married[i][0]),
  ])
  return (
    table(['Rate', 'Single (taxable income)', 'Married filing jointly'], rows, `${Y} federal income tax brackets`) +
    `<p class="text-sm">Taxable income is income after the standard deduction: ${usd(standardDeduction.single)} single, ${usd(standardDeduction.married)} married filing jointly, plus extra amounts for those 65 and older.</p>`
  )
}

function irmaaTable(): string {
  const tiers = TAX_CONFIG.irmaa
  const rows = tiers.map(([single, joint, partB, partD], i) => [
    range(i ? tiers[i - 1][0] : 0, single).replace('$0 – ', 'Up to '),
    range(i ? tiers[i - 1][1] : 0, joint).replace('$0 – ', 'Up to '),
    partB + partD === 0 ? 'None' : `${usd(Math.round((partB + partD) * 12))} / yr`,
  ])
  return (
    table(['Single MAGI', 'Married filing jointly MAGI', 'Extra Part B + D premium'], rows, `${Y} Medicare IRMAA tiers`) +
    '<p class="text-sm">Surcharges are per person on Medicare. The income tiers are adjusted for inflation each year.</p>'
  )
}

function uniformTable(): string {
  // Three side-by-side age/factor column pairs
  const life = Object.entries(TAX_CONFIG.rmd.uniformLifetimeTable)
  const third = Math.ceil(life.length / 3)
  const rows = life.slice(0, third).map((_, i) =>
    [0, 1, 2].flatMap((col) => {
      const entry = life[i + col * third]
      return entry ? [entry[0], entry[1].toFixed(1)] : ['', '']
    }),
  )
  return (
    table(['Age', 'Factor', 'Age', 'Factor', 'Age', 'Factor'], rows, 'IRS Uniform Lifetime Table') +
    '<p class="text-sm">Divide last December 31’s balance by the factor for the age you reach this year. Ages above 110 use the age-110 factor.</p>'
  )
}

const senior = T.seniorDeduction
const TOKENS: Record<string, string> = {
  YEAR: String(Y),
  PREV_YEAR: String(Y - 1),
  NEXT_YEAR: String(Y + 1),
  // State rules can lag the federal year (their table comes out a few months later)
  STATE_YEAR: String(STATE_RULES_YEAR),
  REVIEWED: REVIEWED_DATE,
  REV_PROC: TAX_CONFIG.sources.revProc.short,
  SENIOR_AMOUNT: usd(senior.amount),
  SENIOR_YEARS: `${senior.firstYear}–${senior.lastYear}`,
  SENIOR_START_SINGLE: usd(senior.phaseOutStart.single),
  SENIOR_START_JOINT: usd(senior.phaseOutStart.married),
}

/** The logo: the browser-tab icon itself, under the site's base path (set when the build starts). */
let base = '/'
const logo = () => `<img src="${base}favicon.svg" alt="" width="26" height="26" class="shrink-0">`

export function fillPage(html: string): string {
  const sources: Record<string, { url: string; name: string }> = TAX_CONFIG.sources
  const filled = html
    .replace('<!--BRACKETS-->', bracketsTable())
    .replace('<!--IRMAA_TIERS-->', irmaaTable())
    .replace('<!--UNIFORM_TABLE-->', uniformTable())
    .replace(/<!--SOURCE (\w+): ([^>]*?)-->/g, (_, key: string, covers: string) => {
      const source = sources[key]
      if (!source) throw new Error(`Unknown source "${key}" (add it to TAX_CONFIG.sources)`)
      const what = covers.trim() ? `: ${covers.trim()}` : ''
      return `<li><a href="${source.url}" target="_blank" rel="noopener" class="text-teal-700 underline underline-offset-2 dark:text-teal-400">${escapeHtml(source.name)}</a>${what}</li>`
    })
    .replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
      if (token === 'LOGO') return logo()
      if (!(token in TOKENS)) throw new Error(`Unknown page token ${match}`)
      return TOKENS[token]
    })
  const leftover = filled.match(/<!--(BRACKETS|IRMAA_TIERS|UNIFORM_TABLE|SOURCE)[^>]*-->|\{\{\w+\}\}/)
  if (leftover) throw new Error(`Unfilled page token: ${leftover[0]}`)
  return filled
}

/** Next year's figures are usually all out by mid-November (IRS brackets, SSA COLA, CMS premiums). */
export function updateDue(today = new Date()): boolean {
  return today >= new Date(Date.UTC(Y, 10, 15))
}

/** Date a page last changed: its last commit, or the tax figures' review date if that's later (or git isn't there). */
function lastChanged(path: string): string {
  try {
    const committed = execFileSync('git', ['log', '-1', '--format=%cs', '--', `${path}index.html`], { encoding: 'utf8' }).trim()
    if (committed && committed > TAX_CONFIG.reviewed) return committed
  } catch {
    // Not a git checkout: fall back to the review date
  }
  return TAX_CONFIG.reviewed
}

function sitemap(): string {
  const urls = PAGES.map(([, path]) => `  <url><loc>${SITE}${path}</loc><lastmod>${lastChanged(path)}</lastmod></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function taxYearPages(): Plugin {
  return {
    name: 'tax-year-pages',
    configResolved(config) {
      base = config.base
    },
    buildStart() {
      if (!updateDue()) return
      const message = `Tax figures are for ${Y}; ${Y + 1} figures are due. See YEARLY_UPDATE.md.`
      // GitHub Actions shows this as a warning on the run
      if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Yearly tax update::${message}`)
      this.warn(message)
    },
    transformIndexHtml: fillPage,
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() })
    },
    configureServer(server) {
      // robots.txt points here, so the dev server serves it too
      server.middlewares.use('/sitemap.xml', (_, res) => {
        res.setHeader('Content-Type', 'application/xml')
        res.end(sitemap())
      })
    },
  }
}
