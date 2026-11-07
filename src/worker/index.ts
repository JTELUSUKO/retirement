// The Cloudflare Worker behind willitlast.app. Static files don't reach it (wrangler.jsonc sends only /api/* here).
// /api/love is the heart's public total: one number, with nothing about who tapped it. The rate limit counts by IP
// address inside Cloudflare; this code never stores or logs one.

interface Stub {
  fetch(request: Request): Promise<Response>
}

export interface Env {
  ASSETS: Stub
  LOVE: { idFromName(name: string): unknown; get(id: unknown): Stub }
  LOVE_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

interface DurableState {
  storage: { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void> }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })

/**
 * The total. Taps at the same moment can't overwrite each other only if nothing but storage is awaited between the read
 * and the write: the runtime holds other requests back during storage calls, not while a body is being read.
 */
export class LoveCounter {
  private state: DurableState

  constructor(state: DurableState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const change = request.method === 'POST' ? ((await request.json()) as { change: number }).change : 0
    const count = (await this.state.storage.get<number>('count')) ?? 0
    if (!change) return json({ count })
    const next = Math.max(0, count + change)
    await this.state.storage.put('count', next)
    return json({ count: next })
  }
}

async function love(request: Request, env: Env): Promise<Response> {
  const counter = env.LOVE.get(env.LOVE.idFromName('site'))
  const read = () => counter.fetch(new Request('https://counter/'))
  if (request.method === 'GET') return read()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Browsers send Origin on every POST, so this stops other sites from sending taps from their pages. A script can fake
  // it, and with no accounts nothing ties a tap to a person, so the total is a rough figure, not a guarded one.
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'Forbidden' }, 403)
  const { success } = await env.LOVE_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
  if (!success) return json({ error: 'Too many requests' }, 429)

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null
  const change = body?.action === 'add' ? 1 : body?.action === 'remove' ? -1 : 0
  if (!change) return json({ error: 'Bad request' }, 400)
  return counter.fetch(new Request('https://counter/', { method: 'POST', body: JSON.stringify({ change }) }))
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === '/api/love') return love(request, env)
    return env.ASSETS.fetch(request)
  },
}
