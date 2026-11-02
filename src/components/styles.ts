// Shared button and tab styles, so every page looks and behaves the same. Add size classes (px-*, py-*, text-*) where
// used. Inactive (disabled) buttons stay readable instead of fading out.

/** Main action: dark fill (light fill in dark mode). */
export const PRIMARY =
  'rounded-md bg-slate-900 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-200'

/** Other actions: outlined. */
export const SECONDARY =
  'rounded-md border border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500 disabled:hover:bg-transparent dark:border-slate-500 dark:hover:bg-slate-800 dark:disabled:border-slate-700 dark:disabled:text-slate-400'

/**
 * Tabs and toggles. The selected one has a quiet fill plus a teal underline (over 4:1 against the fill), so it's
 * clear without being louder than the page's main buttons.
 */
export const tabClass = (selected: boolean) =>
  selected
    ? 'rounded-md bg-slate-200 font-semibold text-slate-900 shadow-[inset_0_-2px_0_var(--color-teal-700)] dark:bg-slate-800 dark:text-slate-100 dark:shadow-[inset_0_-2px_0_var(--color-teal-400)]'
    : 'rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
