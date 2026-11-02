const YEAR = new Date().getFullYear()

/** Official sources for the rules and figures the planner uses: [link, name, what it covers] */
const SOURCES: [string, string, string][] = [
  ['https://www.irs.gov/pub/irs-drop/rp-25-32.pdf', 'IRS Revenue Procedure 2025-32', '2026 tax brackets, standard and 65+ deductions, capital gains rates'],
  ['https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors', 'IRS: Deductions for seniors', 'the $6,000 senior deduction for 2025–2028'],
  ['https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500', 'IRS: 2026 retirement plan limits', '401(k) and IRA contribution limits'],
  ['https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-required-minimum-distributions-rmds', 'IRS: Required minimum distributions', 'RMD ages and rules'],
  ['https://www.irs.gov/publications/p590b', 'IRS Publication 590-B', 'IRA distributions and the RMD life expectancy table'],
  ['https://www.irs.gov/publications/p915', 'IRS Publication 915', 'how Social Security benefits are taxed'],
  ['https://www.ssa.gov/benefits/retirement/planner/agereduction.html', 'SSA: Retirement age and benefit reduction', 'claiming before full retirement age'],
  ['https://www.ssa.gov/benefits/retirement/planner/delayret.html', 'SSA: Delayed retirement credits', 'claiming after full retirement age'],
  ['https://www.ssa.gov/myaccount/', 'my Social Security', 'your own benefit estimate'],
  ['https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles', 'CMS: 2026 Medicare premiums', 'Part B and D premiums and IRMAA surcharges'],
  ['https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/', 'Tax Foundation', '2026 state income tax rates and brackets'],
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
          <strong className="text-slate-700 dark:text-slate-300">Data sources (2026 rules, last reviewed November 2026):</strong>{' '}
          Market assumptions are illustrative long-run averages. Not affiliated with or endorsed by the IRS, SSA, CMS or any
          government agency. Rules change; check the latest versions before you act.
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {SOURCES.map(([url, name, what]) => (
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
