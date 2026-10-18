import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FormMode = 'basic' | 'advanced'
/** Guided setup: 'auto' shows it while the plan is blank, 'open' was requested, 'skipped' never auto-shows */
export type GuideState = 'auto' | 'open' | 'skipped'

interface UiPrefs {
  mode: FormMode
  /** Sections the visitor opened or closed (overrides each section's default) */
  open: Record<string, boolean>
  guide: GuideState
  setMode: (mode: FormMode) => void
  setGuide: (guide: GuideState) => void
  setOpen: (section: string, open: boolean) => void
}

/** View preferences, saved in this browser separately from the plan (not exported, not part of backups). */
export const useUiPrefs = create<UiPrefs>()(
  persist(
    (set) => ({
      mode: 'basic',
      open: {},
      guide: 'auto',
      setMode: (mode) => set({ mode }),
      setGuide: (guide) => set({ guide }),
      setOpen: (section, open) => set((s) => ({ open: { ...s.open, [section]: open } })),
    }),
    { name: 'retirement-ui', version: 1 },
  ),
)
