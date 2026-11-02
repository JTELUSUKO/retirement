import type { IconName } from '../components/Icons'

/** The free calculator pages (paths relative to the planner, which sits at the site root) */
export const CALCULATORS: { path: string; name: string; blurb: string; icon: IconName; isNew?: boolean }[] = [
  { path: 'how-long-will-my-money-last/', name: 'How long will my money last?', blurb: 'The age your savings could run out', icon: 'trend' },
  { path: '4-percent-rule-calculator/', name: '4% rule calculator', blurb: 'A safe withdrawal rate for your savings', icon: 'percent', isNew: true },
  { path: 'social-security-claiming-age/', name: 'Social Security claiming age', blurb: 'Claim at 62, 67 or 70? Break-even ages', icon: 'landmark', isNew: true },
  { path: 'kids-investment-account-calculator/', name: 'Kids’ investment account', blurb: 'Grow the new federal children’s account', icon: 'sprout', isNew: true },
  { path: 'roth-conversion-calculator/', name: 'Roth conversion calculator', blurb: 'Tax now vs later on a conversion', icon: 'wallet' },
  { path: 'rmd-calculator/', name: 'RMD calculator', blurb: 'Required minimum distributions by year', icon: 'calendar' },
]
