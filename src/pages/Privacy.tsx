import { LegalSection as Section } from '../components/LegalSection'

const UPDATED = 'November 19, 2026'

/** Privacy policy: what stays in the browser, what goes to Anthropic, and what the host sees. */
export function Privacy() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Privacy policy</h1>
        <p className="text-sm text-muted">Last updated {UPDATED}</p>
      </header>

      <p className="rounded-md border-2 border-teal-600 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-950 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-100">
        In short: no accounts, no cookies set by this site, no tracking and no analytics. Everything you enter stays in
        your browser, unless you choose to ask Claude a question.
      </p>

      <Section title="1. What we collect">
        <p>
          Nothing. There are no accounts or sign-ups, and the site has no server that receives your plan. The planner and
          the calculators run entirely in your browser, and we never see the numbers you enter.
        </p>
      </Section>

      <Section title="2. What is stored on your device">
        <p>The site uses your browser’s own storage, which only you can see:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Your plan</strong>, so it’s still there when you come back. It stays until you clear this site’s data
            in your browser.
          </li>
          <li>
            <strong>Your Light or Dark choice</strong>, if you picked one.
          </li>
          <li>
            <strong>Your Anthropic API key</strong>, only if you use Ask Claude: kept for the current tab, or on this
            device if you tick “remember on this device”. “Forget key” on the Ask Claude page removes it.
          </li>
          <li>
            <strong>A short-lived note</strong> for the current tab, used to reload the page once after a site update.
          </li>
        </ul>
        <p>
          Anyone who uses this browser profile can see this data, so use the site only on a device you trust. Exported
          backup files are saved wherever you choose, and you control them.
        </p>
      </Section>

      <Section title="3. Ask Claude (optional)">
        <p>
          When you ask a question, your browser sends your question, your whole plan (every number you’ve entered) and your API key directly to
          Anthropic (api.anthropic.com). They do not pass through us. Anthropic handles them under its own terms and{' '}
          <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener" className="underline underline-offset-2">
            privacy policy
          </a>
          . Nothing is sent unless you ask a question, and the conversation is not saved: it’s gone when you close or
          reload the page.
        </p>
      </Section>

      <Section title="4. Hosting and server logs">
        <p>
          The site is hosted on Cloudflare. Like any web host, Cloudflare keeps standard logs of page visits (such as IP
          address, browser type, the page requested and the time) to run and protect the service. It may also set a
          strictly necessary security cookie to tell people from bots. These logs don’t include anything you type into
          the planner.
        </p>
      </Section>

      <Section title="5. No tracking, ads or selling data">
        <p>
          The site has no analytics, advertising, tracking pixels or social media widgets, and we don’t sell, rent or
          share data about you, because we don’t have any.
        </p>
      </Section>

      <Section title="6. Links to other sites">
        <p>
          The site links to official sources such as the IRS and Social Security Administration. Those sites have their
          own privacy policies, which apply once you leave this one.
        </p>
      </Section>

      <Section title="7. Deleting your data">
        <p>
          Clear this site’s data in your browser’s settings: that removes your plan, a remembered API key and your theme
          choice. Reset on the planner only blanks the plan, and Undo can bring it back until you reload. Because we hold nothing about you, there is nothing for us to delete. You
          can revoke an API key at any time at console.anthropic.com.
        </p>
      </Section>

      <Section title="8. Who it’s for">
        <p>The site is intended for adults (18 or older) and is not directed at children.</p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>
          This policy may be updated from time to time. The date at the top shows the latest version. See also the{' '}
          <a href="#terms" className="underline underline-offset-2">
            disclaimer and terms of use
          </a>
          .
        </p>
      </Section>
    </article>
  )
}
