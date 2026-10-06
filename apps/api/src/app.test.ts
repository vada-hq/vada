import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HTTPException } from 'hono/http-exception'
import { createApp } from './app.js'
import { ApiError } from './http/errors.js'

const origin = 'http://127.0.0.1:5180'
const noAuth = { handler: async () => new Response() }

test('GET /api/health returns the API health status', async () => {
  const app = createApp({ auth: { handler: async () => { throw new Error('health must not call auth') } }, trustedOrigin: origin })
  const response = await app.request('/api/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('ApiError는 코드와 상태로, HTTPException 400은 INVALID_INPUT으로 응답한다', async () => {
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  app.get('/api/conflict', () => { throw new ApiError('VERSION_CONFLICT', 409) })
  app.get('/api/malformed', () => { throw new HTTPException(400, { message: 'Malformed JSON in request body' }) })
  const conflict = await app.request('/api/conflict')
  assert.equal(conflict.status, 409)
  assert.deepEqual(await conflict.json(), { error: 'VERSION_CONFLICT' })
  const malformed = await app.request('/api/malformed')
  assert.equal(malformed.status, 400)
  assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' })
})

test('예상하지 못한 오류는 원문 없이 분류만 로그에 남긴다', async (t) => {
  const logged: string[] = []
  t.mock.method(console, 'error', (line: string) => { logged.push(line) })
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  app.get('/api/organizations/:organizationId/boom', () => {
    throw new Error('value=secret-token', { cause: Object.assign(new Error('row secret-token'), { code: '23514' }) })
  })
  const response = await app.request('/api/organizations/org-1/boom')
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'Internal server error' })
  assert.equal(logged.length, 1)
  assert.deepEqual(JSON.parse(logged[0]!), {
    event: 'request_failed', method: 'GET', route: '/api/organizations/:organizationId/boom', error: 'Error', sqlState: '23514',
  })
  assert.ok(!logged[0]!.includes('secret-token'))
  assert.ok(!logged[0]!.includes('org-1'))
})
