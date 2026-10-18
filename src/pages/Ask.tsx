import { useRef, useState } from 'react'
import { createClient, describeError, sendMessage } from '../ai/chat'
import { forgetApiKey, loadApiKey, saveApiKey } from '../ai/apiKey'
import { useChatStore } from '../ai/chatStore'
import { describeToolCall } from '../ai/toolNotes'
import { GettingStarted } from '../components/GettingStarted'
import { missingEssentials } from '../engine'
import { usePlanStore } from '../store/planStore'

const SUGGESTIONS = [
  'Am I on track to retire? What matters most in my plan?',
  'What if I retire two years earlier or later?',
  'Should I claim Social Security at 67 or 70?',
  'How exposed am I to a market crash right after I retire?',
]

const button =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800'

function ApiKeySetup({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState('')
  const [remember, setRemember] = useState(false)
  return (
    <section className="max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-medium">Ask Claude about your plan</h2>
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Experimental feature, not shown in the menu. Unlike the rest of the app, it sends your plan to Anthropic when you
        ask a question.
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Claude can explain your results and run what-ifs (“what if I retire at 62?”) using this app’s own calculations.
        It uses your own Anthropic API key, so usage is billed to your Anthropic account.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
        <li>Your key and your plan are sent only to Anthropic (api.anthropic.com), directly from this browser, and only when you ask a question.</li>
        <li>The key stays in this browser: for this tab only, unless you choose to remember it on this device.</li>
        <li>Only use this on a device you trust. Create a key at console.anthropic.com; you can revoke it there anytime.</li>
      </ul>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!key.trim()) return
          saveApiKey(key.trim(), remember)
          onSaved()
        }}
      >
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Anthropic API key</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember on this device
        </label>
        <button type="submit" disabled={!key.trim()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900">
          Save key and start
        </button>
      </form>
    </section>
  )
}

export function Ask() {
  const plan = usePlanStore((s) => s.plan)
  const chat = useChatStore()
  const [hasKey, setHasKey] = useState(() => loadApiKey() !== null)
  const [draft, setDraft] = useState('')
  const abort = useRef<AbortController | null>(null)

  if (!hasKey) return <ApiKeySetup onSaved={() => setHasKey(true)} />
  if (missingEssentials(plan).length > 0) return <GettingStarted plan={plan} onPlanTab={false} />

  const ask = async (text: string) => {
    const stored = loadApiKey()
    if (!text.trim() || chat.busy || !stored) return
    setDraft('')
    const { set, updateLast } = useChatStore.getState()
    set({
      busy: true,
      turns: [...useChatStore.getState().turns, { role: 'user', text, notes: [] }, { role: 'assistant', text: '', notes: [] }],
    })
    abort.current = new AbortController()
    try {
      const { history, sentSnapshot } = useChatStore.getState()
      const result = await sendMessage({
        client: createClient(stored.key),
        history,
        sentSnapshot,
        plan: usePlanStore.getState().plan,
        text,
        signal: abort.current.signal,
        events: {
          onText: (delta) => updateLast((t) => ({ ...t, text: t.text + delta })),
          onTool: (name, input, isError) =>
            updateLast((t) => ({ ...t, notes: [...t.notes, describeToolCall(name, input, isError)] })),
        },
      })
      set({ history: result.history, sentSnapshot: result.sentSnapshot })
      if (result.refused) {
        updateLast((t) => ({ ...t, text: '', error: 'Claude couldn’t answer that one. Try rephrasing your question.' }))
      }
    } catch (err) {
      updateLast((t) => ({ ...t, error: describeError(err) }))
    } finally {
      set({ busy: false })
      abort.current = null
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Claude sees your plan and runs calculations with this app. Educational only, not financial advice.
        </p>
        <div className="flex gap-2">
          <button type="button" className={button} disabled={chat.busy || chat.turns.length === 0} onClick={chat.reset}>
            New conversation
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              abort.current?.abort()
              forgetApiKey()
              chat.reset()
              setHasKey(false)
            }}
          >
            Forget key
          </button>
        </div>
      </div>

      <div role="log" aria-live="polite" className="space-y-4">
        {chat.turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className={button} onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-slate-900 px-4 py-2 text-sm whitespace-pre-wrap text-white dark:bg-slate-100 dark:text-slate-900">
              {t.text}
            </div>
          ) : (
            <div key={i} className="max-w-[95%] space-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              {t.notes.length > 0 && (
                <ul className="space-y-0.5 text-xs text-slate-500">
                  {t.notes.map((n, j) => (
                    <li key={j}>⚙ {n}</li>
                  ))}
                </ul>
              )}
              {t.text ? (
                <div className="leading-relaxed whitespace-pre-wrap">{t.text}</div>
              ) : (
                !t.error && chat.busy && i === chat.turns.length - 1 && <div className="text-slate-500">Thinking…</div>
              )}
              {t.error && <div role="alert" className="text-red-600 dark:text-red-400">✕ {t.error}</div>}
            </div>
          ),
        )}
      </div>

      <form
        className="sticky bottom-0 flex items-end gap-2 bg-slate-50 py-3 dark:bg-slate-950"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(draft)
        }}
      >
        <textarea
          rows={2}
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Ask about your plan… (Enter to send, Shift+Enter for a new line)"
          aria-label="Your question"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(draft)
            }
          }}
        />
        {chat.busy ? (
          <button type="button" className={button} onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!draft.trim()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900">
            Send
          </button>
        )}
      </form>
    </div>
  )
}
