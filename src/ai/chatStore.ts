import { create } from 'zustand'
import type { History } from './chat'

export interface Turn {
  role: 'user' | 'assistant'
  text: string
  /** Short notes for tools Claude ran while answering */
  notes: string[]
  error?: string
}

interface ChatState {
  /** What the user sees */
  turns: Turn[]
  /** What the API sees (append-only) */
  history: History
  sentSnapshot: string
  busy: boolean
  set: (patch: Partial<Omit<ChatState, 'set' | 'reset' | 'updateLast'>>) => void
  updateLast: (fn: (turn: Turn) => Turn) => void
  reset: () => void
}

/** In-memory only: the conversation survives switching tabs but not a page reload. */
export const useChatStore = create<ChatState>()((set) => ({
  turns: [],
  history: [],
  sentSnapshot: '',
  busy: false,
  set: (patch) => set(patch),
  updateLast: (fn) => set((s) => ({ turns: [...s.turns.slice(0, -1), fn(s.turns.at(-1)!)] })),
  reset: () => set({ turns: [], history: [], sentSnapshot: '', busy: false }),
}))
