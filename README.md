# Retirement Planner

A private, browser-only retirement planner for US pre-retirees (ages 50–65).

Enter your accounts, savings, expected spending and Social Security estimate to see:

- Projected savings at retirement (in today's dollars and future dollars)
- Your chance of the money lasting, from 1,000 simulated market histories (Monte Carlo)
- The range of outcomes, from poor markets to good ones
- Your Social Security benefit for any claiming age from 62 to 70
- How each account type (pre-tax, Roth, taxable, cash, HSA) is drawn down, including RMDs
- A year-by-year table

Your data never leaves your browser.

> **Disclaimer:** This is an educational planning aid, not financial, tax or investment advice.
> Projections use simplified assumptions (a fixed withdrawal order, no taxes yet).

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173/retirement/
npm test
```

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for how the code is organized and the roadmap.
