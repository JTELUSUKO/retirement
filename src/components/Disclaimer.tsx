/** Short, prominent disclaimer shown at the top of every page (and on the printed summary). */
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
      <p className="font-bold">
        ⚠ For educational purposes only. This is NOT financial, investment, tax or legal advice.
      </p>
      <p className="mt-1 font-semibold">
        Results are estimates based on your inputs and simplified assumptions, not guarantees. Calculations may contain
        errors or differ from other tools and official figures, and we accept no responsibility for them or for any
        decision you make. Talk to a qualified, licensed professional before making any financial decision.
        {!printable && (
          <>
            {' '}
            <a href="#terms" className="underline underline-offset-2">
              Read the full disclaimer and terms
            </a>
            .
          </>
        )}
      </p>
    </div>
  )
}
