import { TAX_CONFIG } from '../engine'
import { REVIEWED_DATE } from '../utils/taxYear'

const YEAR = new Date().getFullYear()

const S = TAX_CONFIG.sources
const Y = TAX_CONFIG.year

/** Official sources for the rules and figures the planner uses (links live in the tax-year config): [source, what it covers] */
const SOURCES: [{ url: string; name: string }, string][] = [
  [S.revProc, `${Y} tax brackets, standard and 65+ deductions, capital gains rates`],
  [S.seniorDeduction, 'the senior deduction'],
  [S.planLimits, '401(k) and IRA contribution limits'],
  [S.rmdTopics, 'RMD ages and rules'],
  [S.pub590b, 'IRA distributions and the RMD life expectancy table'],
  [S.pub915, 'how Social Security benefits are taxed'],
  [S.ssaEarly, 'claiming before full retirement age'],
  [S.ssaDelayed, 'claiming after full retirement age'],
  [S.mySocialSecurity, 'your own benefit estimate'],
  [S.medicarePremiums, 'Part B and D premiums and IRMAA surcharges'],
  [S.stateTax, `${Y} state income tax rates and brackets`],
]

/** Disclaimer, privacy statement and data sources (hidden when printing; the summary has its own). */
export function Footer() {
  return (
    <footer className="mt-16 space-y-4 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500 print:hidden dark:border-slate-800">
      <p className="rounded-md border border-amber-400 bg-amber-50 p-3 font-semibold text-amber-950 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100">
        <strong className="font-bold">Important:</strong> This is an educational planning tool, not financial, tax,
        investment or legal advice, and not a recommendation to buy, sell or do anything. The site’s owner is not a
        registered investment adviser or fiduciary, and using it creates no advisory relationship. Results are estimates
        based on your inputs and simplified assumptions about markets, inflation, taxes and Social Security. They are not
        guarantees, and actual results will differ. Calculations may contain errors or mismatches with other tools or
        official figures; we accept no responsibility or liability for them. Consult a qualified, licensed professional before making financial
        decisions. Provided as is, without warranty; you use it at your own risk.{' '}
        <a href="#terms" className="underline underline-offset-2">Full disclaimer and terms</a>.
      </p>
      <p>
        <strong className="text-slate-700 dark:text-slate-300">Privacy:</strong> This app has no accounts, cookies, tracking
        or analytics. Everything you enter stays in this browser and is never sent anywhere. Your plan is saved only on
        this device; clearing your browser data erases it, so use Export to keep a copy. (Our hosting provider, like any
        web host, keeps standard server logs of page visits.)
      </p>
      <div>
        <p>
          <strong className="text-slate-700 dark:text-slate-300">Data sources ({Y} rules, last reviewed {REVIEWED_DATE}):</strong>{' '}
          Market assumptions are illustrative long-run averages. Not affiliated with or endorsed by the IRS, SSA, CMS or any
          government agency. Rules change; check the latest versions before you act.
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {SOURCES.map(([{ url, name }, what]) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener" className="underline underline-offset-2">
                {name}
              </a>
              : {what}
            </li>
          ))}
        </ul>
      </div>
      <p>
        <strong className="text-slate-700 dark:text-slate-300">Free calculators:</strong>{' '}
        <a href="roth-conversion-calculator/" className="underline underline-offset-2">Roth conversion calculator</a>
        {' · '}
        <a href="rmd-calculator/" className="underline underline-offset-2">RMD calculator</a>
      </p>
      <p>© {YEAR} willitlast.app. All rights reserved.</p>
    </footer>
  )
}
