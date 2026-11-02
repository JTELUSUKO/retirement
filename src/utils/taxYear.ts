import { TAX_CONFIG } from '../engine'

// Labels for the tax year's figures, shown on the pages ("2026 rules, last reviewed November 1, 2026").

const reviewed = new Date(`${TAX_CONFIG.reviewed}T00:00:00Z`)

/** "November 1, 2026" */
export const REVIEWED_DATE = reviewed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
