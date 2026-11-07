import { useEffect, useState } from 'react'
import { useUiPrefs } from '../store/uiPrefs'
import { Icon } from './Icons'
import { tabClass } from './styles'

const LOVE_URL = `${import.meta.env.BASE_URL}api/love`

/** The total from a response, or null if the server didn't answer properly. */
async function total(response: Response): Promise<number | null> {
  if (!response.ok) return null
  const { count } = (await response.json()) as { count?: unknown }
  return typeof count === 'number' ? count : null
}

/**
 * "Love this app": a heart with a public total (src/worker/index.ts). This device remembers its own tap, and tapping
 * again takes it back. If the server can't be reached the heart shows no number and a tap changes nothing.
 */
export function LoveButton() {
  const loved = useUiPrefs((s) => s.loved)
  const setLoved = useUiPrefs((s) => s.setLoved)
  const [count, setCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let current = true
    fetch(LOVE_URL)
      .then(total)
      // A tap's answer may already be here, and it's newer
      .then((value) => current && setCount((shown) => shown ?? value))
      .catch(() => {
        // No total to show: the heart still appears
      })
    return () => {
      current = false
    }
  }, [])

  // Tapped in another tab: without this, a tap here would send a second "add"
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === useUiPrefs.persist.getOptions().name) void useUiPrefs.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = async () => {
    if (sending) return
    setSending(true)
    try {
      const response = await fetch(LOVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: loved ? 'remove' : 'add' }),
      })
      const value = await total(response)
      if (value !== null) {
        setCount(value)
        setLoved(!loved)
      }
    } catch {
      // Not sent: the heart stays as it was
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Not `disabled`, which can drop keyboard focus from the button on every tap
      aria-disabled={sending}
      aria-pressed={loved}
      aria-label={count === null ? 'Love this app' : `Love this app. ${count.toLocaleString('en-US')} so far`}
      title="Love this app"
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 px-1.5 text-sm font-medium tabular-nums print:hidden ${tabClass(false)}`}
    >
      <Icon name="heart" size={16} className={loved ? 'fill-current text-rose-600 dark:text-rose-400' : ''} />
      {count !== null && count.toLocaleString('en-US')}
    </button>
  )
}
