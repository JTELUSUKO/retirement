import Anthropic from '@anthropic-ai/sdk'
import type { Plan } from '../engine'
import { ASSISTANT_MODEL, planSnapshot, SYSTEM_PROMPT } from './prompt'
import { ASSISTANT_TOOLS, executeTool } from './tools'

export type History = Anthropic.Beta.BetaMessageParam[]

export interface ChatEvents {
  /** Streamed answer text. */
  onText: (delta: string) => void
  /** A tool ran locally (for showing "ran a what-if…" in the transcript). */
  onTool: (name: string, input: unknown, isError: boolean) => void
}

export interface SendResult {
  history: History
  /** Plan snapshot most recently sent to Claude (only re-sent when it changes). */
  sentSnapshot: string
  /** Set when the model declined and no fallback could answer. */
  refused: boolean
}

/** Browser client using the visitor's own key. Requests go straight to api.anthropic.com. */
export const createClient = (apiKey: string) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

/**
 * Send one user message and run the tool loop until Claude finishes.
 * The history is append-only: the system prompt never changes, and a new plan snapshot is
 * attached to the user's message only when the plan has changed since the last one sent.
 */
export async function sendMessage(opts: {
  client: Anthropic
  history: History
  sentSnapshot: string
  plan: Plan
  text: string
  events: ChatEvents
  signal?: AbortSignal
}): Promise<SendResult> {
  const { client, plan, events, signal } = opts
  const snapshot = planSnapshot(plan)
  const userContent: Anthropic.Beta.BetaTextBlockParam[] = []
  if (snapshot !== opts.sentSnapshot) {
    userContent.push({ type: 'text', text: `Current plan:\n${snapshot}` })
  }
  userContent.push({ type: 'text', text: opts.text })
  const history: History = [...opts.history, { role: 'user', content: userContent }]
  let jsonRetries = 0

  while (true) {
    const stream = client.beta.messages.stream(
      {
        model: ASSISTANT_MODEL,
        max_tokens: 64000,
        system: SYSTEM_PROMPT,
        tools: ASSISTANT_TOOLS,
        messages: history,
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' }, // caches the growing conversation prefix
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default', // a policy decline is retried server-side on the recommended model
      },
      { signal },
    )
    stream.on('text', events.onText)

    let message: Anthropic.Beta.BetaMessage
    try {
      message = await stream.finalMessage()
      jsonRetries = 0
    } catch (err) {
      // Only an unparseable streamed tool input is retried; API errors go to the caller.
      if (err instanceof Anthropic.APIError || signal?.aborted || jsonRetries++ >= 2) throw err
      continue
    }

    // Declined even after the fallback: discard the partial answer
    if (message.stop_reason === 'refusal') return { history, sentSnapshot: snapshot, refused: true }

    if (message.stop_reason === 'pause_turn') {
      history.push({ role: 'assistant', content: message.content })
      continue
    }

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    history.push({ role: 'assistant', content: message.content })
    if (toolUses.length === 0) return { history, sentSnapshot: snapshot, refused: false }
    if (message.stop_reason === 'max_tokens') throw new Error('The answer was cut off. Please try again.')

    // Run every tool call, then return all results in one user message
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
      const { content, isError } = executeTool(plan, use.name, use.input)
      events.onTool(use.name, use.input, isError)
      return { type: 'tool_result', tool_use_id: use.id, content, is_error: isError }
    })
    history.push({ role: 'user', content: results })
  }
}

/** Friendly message for an error from sendMessage. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIUserAbortError) return 'Stopped.'
  if (err instanceof Anthropic.AuthenticationError) return 'That API key was rejected. Check it and try again.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key doesn’t have access to the model.'
  if (err instanceof Anthropic.RateLimitError) return 'Rate limit reached for this API key. Wait a moment and try again.'
  if (err instanceof Anthropic.APIConnectionError) return 'Couldn’t reach the Anthropic API. Check your connection.'
  if (err instanceof Anthropic.APIError) return `The API returned an error (${err.status ?? 'unknown'}). Please try again.`
  return err instanceof Error ? err.message : 'Something went wrong.'
}
