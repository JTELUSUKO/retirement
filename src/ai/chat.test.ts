import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { examplePlan } from '../store/planStore'
import { describeError, sendMessage } from './chat'
import { ASSISTANT_MODEL, planSnapshot, SYSTEM_PROMPT } from './prompt'

type Event = Record<string, unknown>
const sse = (events: Event[]) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
const start = (id: string): Event => ({
  type: 'message_start',
  message: { id, type: 'message', role: 'assistant', model: ASSISTANT_MODEL, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } },
})
const end = (stop: string): Event[] => [
  { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 20 } },
  { type: 'message_stop' },
]
const toolTurn = (input: object) =>
  sse([
    start('msg_1'),
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'run_what_if', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
    { type: 'content_block_stop', index: 0 },
    ...end('tool_use'),
  ])
const textTurn = (text: string, stop = 'end_turn') =>
  sse([
    start('msg_2'),
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    ...end(stop),
  ])

/** Client whose fetch replays canned streaming responses and records each request. */
function fakeClient(responses: (string | { status: number; body: object })[]) {
  const requests: { body: Record<string, unknown>; headers: Headers }[] = []
  const fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ body: JSON.parse(String(init!.body)), headers: new Headers(init!.headers) })
    const next = responses.shift()!
    if (typeof next !== 'string') {
      return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'content-type': 'application/json' } })
    }
    return new Response(next, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 })
  return { client, requests }
}

const noEvents = { onText: () => {}, onTool: () => {} }

describe('sendMessage', () => {
  it('runs a what-if tool locally and streams the final answer', async () => {
    const { client, requests } = fakeClient([toolTurn({ retirementAge: 63 }), textTurn('Retiring at 63 lowers your odds.')])
    const text: string[] = []
    const tools: string[] = []
    const result = await sendMessage({
      client, history: [], sentSnapshot: '', plan: examplePlan, text: 'What if I retire at 63?',
      events: { onText: (d) => text.push(d), onTool: (name) => tools.push(name) },
    })

    expect(text.join('')).toBe('Retiring at 63 lowers your odds.')
    expect(tools).toEqual(['run_what_if'])
    expect(result.refused).toBe(false)

    // First request: frozen system prompt, model, fallbacks, caching, plan snapshot + question
    const first = requests[0]
    expect(first.body).toMatchObject({ model: ASSISTANT_MODEL, system: SYSTEM_PROMPT, fallbacks: 'default', cache_control: { type: 'ephemeral' } })
    expect(first.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
    const firstUser = (first.body.messages as Anthropic.Beta.BetaMessageParam[])[0].content as { text: string }[]
    expect(firstUser[0].text).toBe(`Current plan:\n${planSnapshot(examplePlan)}`)
    expect(firstUser[1].text).toBe('What if I retire at 63?')

    // Second request carries the tool result computed by the engine
    const second = requests[1].body.messages as Anthropic.Beta.BetaMessageParam[]
    const toolResult = (second.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[])[0]
    expect(toolResult.tool_use_id).toBe('toolu_1')
    const data = JSON.parse(toolResult.content as string)
    expect(data.withChanges.retirementAge).toBe(63)
    expect(data.currentPlan.retirementAge).toBe(examplePlan.retirementAge)

    // History is append-only: user, assistant(tool_use), user(tool_result), assistant(text)
    expect(result.history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
  })

  it('sends the plan snapshot again only when the plan changed', async () => {
    const { client, requests } = fakeClient([textTurn('One.'), textTurn('Two.'), textTurn('Three.')])
    let r = await sendMessage({ client, history: [], sentSnapshot: '', plan: examplePlan, text: 'Hi', events: noEvents })
    r = await sendMessage({ client, history: r.history, sentSnapshot: r.sentSnapshot, plan: examplePlan, text: 'Again', events: noEvents })
    const changed = { ...examplePlan, annualSpending: 50_000 }
    await sendMessage({ client, history: r.history, sentSnapshot: r.sentSnapshot, plan: changed, text: 'Now?', events: noEvents })

    const lastUser = (i: number) => (requests[i].body.messages as Anthropic.Beta.BetaMessageParam[]).at(-1)!.content as { text: string }[]
    expect(lastUser(1).map((b) => b.text)).toEqual(['Again'])
    expect(lastUser(2)[0].text).toBe(`Current plan:\n${planSnapshot(changed)}`)
    // Earlier turns are byte-identical across requests (append-only history)
    expect(JSON.stringify((requests[2].body.messages as unknown[]).slice(0, 3))).toBe(JSON.stringify(requests[1].body.messages))
  })

  it('reports a refusal and does not keep the partial answer', async () => {
    const { client } = fakeClient([textTurn('Partial', 'refusal')])
    const r = await sendMessage({ client, history: [], sentSnapshot: '', plan: examplePlan, text: '?', events: noEvents })
    expect(r.refused).toBe(true)
    expect(r.history.map((m) => m.role)).toEqual(['user'])
  })

  it('returns an error result to Claude for invalid tool input', async () => {
    const { client, requests } = fakeClient([toolTurn({ retirementAge: 'sixty' }), textTurn('Let me fix that.')])
    const errors: boolean[] = []
    await sendMessage({ client, history: [], sentSnapshot: '', plan: examplePlan, text: '?', events: { onText: () => {}, onTool: (_n, _i, e) => errors.push(e) } })
    const toolResult = ((requests[1].body.messages as Anthropic.Beta.BetaMessageParam[]).at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[])[0]
    expect(toolResult.is_error).toBe(true)
    expect(errors).toEqual([true])
  })

  it('turns a bad API key into a friendly message', async () => {
    const { client } = fakeClient([{ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }])
    const err = await sendMessage({ client, history: [], sentSnapshot: '', plan: examplePlan, text: '?', events: noEvents }).catch((e) => e)
    expect(describeError(err)).toMatch(/API key was rejected/)
  })
})
