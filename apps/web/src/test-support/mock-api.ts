import { vi } from 'vitest'

export type ApiCall = { method: string; path: string; body: unknown; signal: AbortSignal | null }
type Handler = (call: ApiCall) => Response | Promise<Response>
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function describeRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost')
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const call: ApiCall = {
    method,
    path: url.pathname + url.search,
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    signal: init?.signal ?? null,
  }
  return { url, call }
}

// No network fallback. Assert after React cleanup so caught request failures cannot pass silently.
export function mockApi() {
  const routes = new Map<string, Handler>()
  const unexpected: string[] = []
  const calls: ApiCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const { url, call } = describeRequest(input, init)
      const { method, path } = call
      calls.push(call)
      const handler =
        url.origin === 'http://localhost' ? routes.get(`${method} ${path}`) : undefined
      if (!handler) {
        const message = `Unregistered API request: ${method} ${url.href}`
        unexpected.push(message)
        throw new Error(message)
      }
      return handler(call)
    }),
  )
  return {
    calls,
    on(method: string, path: string, handler: Handler) {
      routes.set(`${method.toUpperCase()} ${path}`, handler)
    },
    assertNoUnexpectedRequests() {
      if (unexpected.length) throw new Error(unexpected.join('\n'))
    },
  }
}

export function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>(done => {
    resolve = done
  })
  return { promise, resolve }
}
