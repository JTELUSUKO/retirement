/**
 * Prominent disclaimer at the top of every page: a short, bold version on screen (the full text is in the footer and
 * the terms), and the full version on the printed summary, which gets handed around without the site.
 */
export function DisclaimerBanner({ printable = false }: { printable?: boolean }) {
  return (
    <div
      role="note"
      aria-label="Disclaimer"
      className={`rounded-md border-2 border-amber-500 bg-amber-100 px-4 py-3 text-sm text-amber-950 ${
        // The printed summary is always on white paper, so it keeps the light colors
        printable ? '' : 'print:hidden dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100'
      }`}
    >
      {printable ? (
        <>
          <p className="font-bold">⚠ For educational purposes only. This is NOT financial, investment, tax or legal advice.</p>
          <p className="mt-1 font-semibold">
            Results are estimates based on your inputs and simplified assumptions, not guarantees. Calculations may contain
            errors or differ from other tools and official figures, and we accept no responsibility for them or for any
            decision you make. Talk to a qualified, licensed professional before making any financial decision.
          </p>
        </>
      ) : (
        <p className="font-semibold">
          <strong className="font-bold">⚠ Educational only — not financial, tax or legal advice.</strong> Results are
          estimates, not guarantees, and may contain errors; we accept no responsibility for them.{' '}
          <a href="#terms" className="font-bold underline underline-offset-2">
            Read the full disclaimer
          </a>
          .
        </p>
      )}
    </div>
  )
}
