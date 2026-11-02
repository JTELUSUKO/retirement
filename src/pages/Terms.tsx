const UPDATED = 'November 1, 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  )
}

/** Full disclaimer and terms of use. */
export function Terms() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Disclaimer and terms of use</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Last updated {UPDATED}</p>
      </header>

      <p className="rounded-md border-2 border-amber-500 bg-amber-100 px-4 py-3 text-sm font-bold text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100">
        By using this site you agree to these terms. If you don’t agree, please don’t use it.
      </p>

      <Section title="1. Educational use only, not advice">
        <p>
          <strong>
            This site is an educational planning calculator. Nothing on it is financial, investment, tax, legal,
            insurance or retirement advice, and nothing on it is a recommendation to buy, sell, hold or do anything.
          </strong>{' '}
          It does not know your full situation and does not tell you what you should do.
        </p>
        <p>
          The site and its owner are not a registered investment adviser, broker-dealer, financial planner, tax preparer,
          accountant, attorney or fiduciary, and using the site does not create any client, advisory or fiduciary
          relationship.
        </p>
      </Section>

      <Section title="2. Estimates, not guarantees">
        <p>
          <strong>All results are hypothetical estimates.</strong> They depend entirely on the numbers you enter and on
          simplified assumptions about investment returns, inflation, taxes, Social Security, Medicare, healthcare costs
          and life expectancy. Simulated market outcomes (“chance your money lasts”) are illustrations, not
          predictions. Past or average market returns do not guarantee future results, and investing involves risk,
          including loss of principal.
        </p>
        <p>
          Tax, Social Security and Medicare rules are complex, change often, and are simplified here. Some rules and
          situations are not modeled at all. Your actual results will differ, possibly by a lot.
        </p>
      </Section>

      <Section title="3. Calculation errors and mismatches">
        <p>
          <strong>
            The calculations may contain errors, bugs, outdated figures or simplifications, and their results may not
            match other calculators, statements from the IRS or Social Security Administration, your tax return or what
            a professional would calculate. We accept no responsibility or liability for any such error or mismatch.
          </strong>{' '}
          Always check important numbers against official sources and with a qualified professional.
        </p>
      </Section>

      <Section title="4. Your inputs are your responsibility">
        <p>
          Results are only as good as the numbers you enter. You are responsible for checking that your inputs (ages,
          balances, income, spending, benefits and assumptions) are complete and correct. The site does not verify them.
        </p>
      </Section>

      <Section title="5. AI assistant (experimental)">
        <p>
          The optional “Ask Claude” assistant uses an AI model from Anthropic with an API key you provide; your
          questions and plan go directly from your browser to Anthropic under their terms. <strong>AI answers can be
          wrong, incomplete or made up, are educational only and are not advice.</strong> Check anything it tells you
          before relying on it.
        </p>
      </Section>

      <Section title="6. Talk to a professional">
        <p>
          <strong>
            Before making any financial decision, including when to retire, how much to spend, when to claim Social
            Security, Roth conversions, withdrawals or buying an annuity, consult a qualified, licensed professional
          </strong>{' '}
          such as a fee-only fiduciary financial adviser, CPA or tax attorney who can review your full situation.
        </p>
      </Section>

      <Section title="7. No warranty">
        <p>
          The site is provided “as is” and “as available”, without warranties of any kind, express or implied,
          including accuracy, completeness, timeliness, fitness for a particular purpose and non-infringement. We try to
          keep figures current with official sources, but errors, omissions and outdated information are possible, and
          the site may change or stop working at any time.
        </p>
      </Section>

      <Section title="8. Limitation of liability">
        <p>
          To the fullest extent allowed by law, the site’s owner is not liable for any loss or damage of any kind,
          including financial loss, lost savings, taxes, penalties or lost opportunities, arising from your use of, or
          reliance on, the site or its results, including any calculation error or inaccuracy. You use the site and make your decisions at your own risk and are solely
          responsible for them.
        </p>
      </Section>

      <Section title="9. Indemnification">
        <p>
          You agree to hold harmless and indemnify the site’s owner against any claims, losses or costs (including
          reasonable legal fees) arising from your use or misuse of the site or your breach of these terms.
        </p>
      </Section>

      <Section title="10. Your data and privacy">
        <p>
          The calculator has no accounts, cookies, tracking or analytics. What you enter stays in your browser and is
          not sent to us. Clearing your browser data erases your plan, so use Export to keep a copy. Like any web host,
          our hosting provider keeps standard server logs of page visits.
        </p>
      </Section>

      <Section title="11. Third-party information and links">
        <p>
          Figures come from public sources such as the IRS, Social Security Administration, CMS and the Tax Foundation,
          listed with links at the bottom of each page.
          Links to other sites are for convenience only; we don’t control or endorse them.
        </p>
      </Section>

      <Section title="12. Not affiliated with any government agency">
        <p>
          This site is independent. It is not affiliated with, endorsed by or connected to the IRS, the Social Security
          Administration, the Centers for Medicare &amp; Medicaid Services, any state tax agency or any other government
          body, or with any financial institution.
        </p>
      </Section>

      <Section title="13. Who it’s for">
        <p>
          The site models United States federal and state rules and is intended for adults (18 or older) planning under
          US rules. It is not designed for other countries’ tax or pension systems.
        </p>
      </Section>

      <Section title="14. Severability">
        <p>
          If any part of these terms is found unenforceable, the rest stays in effect, and that part is enforced to the
          fullest extent allowed.
        </p>
      </Section>

      <Section title="15. Changes to these terms">
        <p>
          These terms may be updated from time to time. The date at the top shows the latest version. Continuing to use
          the site after a change means you accept the updated terms.
        </p>
      </Section>
    </article>
  )
}
