import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FormMode = 'basic' | 'advanced'

interface UiPrefs {
  mode: FormMode
  /** Sections the visitor opened or closed (overrides each section's default) */
  open: Record<string, boolean>
  setMode: (mode: FormMode) => void
  setOpen: (section: string, open: boolean) => void
}

/** View preferences, saved in this browser separately from the plan (not exported, not part of backups). */
export const useUiPrefs = create<UiPrefs>()(
  persist(
    (set) => ({
      mode: 'basic',
      open: {},
      setMode: (mode) => set({ mode }),
      setOpen: (section, open) => set((s) => ({ open: { ...s.open, [section]: open } })),
    }),
    { name: 'retirement-ui', version: 1 },
  ),
)
