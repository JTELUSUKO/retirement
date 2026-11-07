import { beforeEach, describe, expect, it } from 'vitest'
import worker, { LoveCounter, type Env } from './index'

const SITE = 'https://willitlast.app'

let stored: Record<string, unknown>
let allowed: boolean
let limitKeys: string[]
let env: Env

beforeEach(() => {
  stored = {}
  allowed = true
  limitKeys = []
  const counter = new LoveCounter({
    storage: {
      get: async <T,>(key: string) => stored[key] as T | undefined,
      put: async (key, value) => {
        stored[key] = value
      },
    },
  })
  env = {
    ASSETS: { fetch: async () => new Response('a static file') },
    LOVE: { idFromName: () => 'site', get: () => counter },
    LOVE_LIMIT: {
      limit: async ({ key }) => {
        limitKeys.push(key)
        return { success: allowed }
      },
    },
  }
})

const post = (body: string, origin: string | null = SITE) =>
  new Request(`${SITE}/api/love`, {
    method: 'POST',
    body,
    headers: { ...(origin ? { Origin: origin } : {}), 'CF-Connecting-IP': '203.0.113.9' },
  })
const send = (action: string) => worker.fetch(post(JSON.stringify({ action })), env)
const count = async (response: Response) => ((await response.json()) as { count: number }).count

describe('/api/love', () => {
  it('starts at zero, counts taps and undos, and is never cached', async () => {
    const first = await worker.fetch(new Request(`${SITE}/api/love`), env)
    expect(await count(first)).toBe(0)
    expect(first.headers.get('Cache-Control')).toBe('no-store')
    expect(await count(await send('add'))).toBe(1)
    expect(await count(await send('add'))).toBe(2)
    expect(await count(await send('remove'))).toBe(1)
    expect(await count(await worker.fetch(new Request(`${SITE}/api/love`), env))).toBe(1)
  })

  it('never goes below zero', async () => {
    expect(await count(await send('remove'))).toBe(0)
  })

  it('stores only the number', async () => {
    await send('add')
    expect(stored).toEqual({ count: 1 })
  })

  it('refuses taps from other sites, or with no Origin', async () => {
    expect((await worker.fetch(post('{"action":"add"}', 'https://example.com'), env)).status).toBe(403)
    expect((await worker.fetch(post('{"action":"add"}', null), env)).status).toBe(403)
    expect(stored).toEqual({})
  })

  it('refuses anything but add or remove, including a bigger number', async () => {
    for (const body of ['{"action":"reset"}', '{"change":1000}', 'not json', 'null']) {
      expect((await worker.fetch(post(body), env)).status).toBe(400)
    }
    expect(stored).toEqual({})
  })

  it('stops after the rate limit, counting per visitor', async () => {
    allowed = false
    expect((await send('add')).status).toBe(429)
    expect(stored).toEqual({})
    expect(limitKeys).toEqual(['203.0.113.9'])
  })

  it('allows only GET and POST', async () => {
    expect((await worker.fetch(new Request(`${SITE}/api/love`, { method: 'DELETE' }), env)).status).toBe(405)
  })
})

it('passes everything else to the static files', async () => {
  expect(await (await worker.fetch(new Request(`${SITE}/api/other`), env)).text()).toBe('a static file')
})
