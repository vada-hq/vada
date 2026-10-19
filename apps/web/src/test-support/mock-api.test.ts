import { afterEach, expect, test, vi } from 'vitest'
import { deferredResponse, json, mockApi } from './mock-api'

afterEach(() => vi.unstubAllGlobals())

test('matches method and exact path and records request bodies', async () => {
  const api = mockApi()
  api.on('PATCH', '/api/request', () => json({ saved: true }))
  const response = await fetch('/api/request', {
    method: 'PATCH',
    body: JSON.stringify({ version: 2 }),
  })
  expect(await response.json()).toEqual({ saved: true })
  expect(api.calls[0]).toMatchObject({
    method: 'PATCH',
    path: '/api/request',
    body: { version: 2 },
  })
  api.assertNoUnexpectedRequests()
})

test('unregistered calls remain failures even when application code catches their rejections', async () => {
  const api = mockApi()
  api.on('GET', '/api/request', () => json({}))
  for (const path of ['/api/request?unexpected=1', 'https://example.test/api/request']) {
    await fetch(path).catch(() => undefined)
  }
  await fetch('/api/request', { method: 'POST' }).catch(() => undefined)
  expect(() => api.assertNoUnexpectedRequests()).toThrow('Unregistered API request')
  expect(api.calls).toHaveLength(3)
})

test('supports delayed responses and explicit server failures', async () => {
  const api = mockApi()
  const pending = deferredResponse()
  api.on('GET', '/api/request', () => pending.promise)
  const response = fetch('/api/request')
  pending.resolve(json({ error: 'UNAVAILABLE' }, 503))
  expect((await response).status).toBe(503)
  api.assertNoUnexpectedRequests()
})
