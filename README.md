# Retirement Planner

A private, browser-only retirement planner for US pre-retirees (ages 50–65).

Enter your accounts, savings, expected spending and Social Security estimate to see:

- A guided setup for first-time visitors (five short steps), or the full form
- A plain-language verdict, plus which changes would help most (retire later, spend less, claim later, guardrails)
- Projected savings at retirement (in today's dollars and future dollars)
- Your chance of the money lasting, from 1,000 simulated market histories (Monte Carlo)
- The range of outcomes, from poor markets to good ones
- Your Social Security benefit for any claiming age from 62 to 70
- How each account type (pre-tax, Roth, taxable, cash, HSA) is drawn down, including RMDs
- Approximate federal and state income tax on retirement withdrawals and Social Security (all 50 states + DC)
- Healthcare costs before and after Medicare, paid from your HSA first
- Other income: annuities, pensions, part-time work and rental income
- For couples: what happens if one spouse dies first (survivor Social Security, lower spending, single filing)
- What buying an annuity with part of your savings would do to your odds and what you leave behind
- A year-by-year table
- A printable one-document summary (save as PDF)
- "How much can I safely spend?", spending guardrails, Roth conversions, Medicare surcharges (IRMAA), long-term care and investment fees
- Side-by-side what-if scenarios (retire earlier, spend less, claim Social Security later) and stress tests (market crash, high inflation)

Your data stays in your browser. Use **Export** to save a backup file and **Import** to restore it.

**Ask Claude** (experimental, hidden from the menu; open `#ask` directly): paste your own Anthropic API key to chat
about your plan. Unlike the rest of the app, it sends your plan to Anthropic when you ask a question.

> **Disclaimer:** This is an educational planning aid, not financial, tax or investment advice.
> Projections use simplified assumptions (a fixed withdrawal order, approximate state rules, no capital gains).

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173/retirement/
npm test
```

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for how the code is organized and the roadmap.
