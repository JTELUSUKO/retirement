const YEAR = new Date().getFullYear()

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
      <p>
        <strong className="text-slate-700 dark:text-slate-300">Data sources (2026 rules, last updated October 2026):</strong>{' '}
        IRS (tax brackets, deductions, contribution limits, RMD tables), Social Security Administration (claiming and
        survivor rules), CMS (Medicare premiums and IRMAA), and the Tax Foundation (state income tax). Market assumptions
        are illustrative long-run averages. Not affiliated with or endorsed by the IRS, SSA, CMS or any government
        agency.
      </p>
      <p>© {YEAR} willitlast.app. All rights reserved.</p>
    </footer>
  )
}
