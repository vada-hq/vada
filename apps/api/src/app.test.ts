import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HTTPException } from 'hono/http-exception'
import { createApp } from './app.js'
import { ApiError } from './http/errors.js'
import { setErrorReporter } from './http/on-error.js'

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

test('조직 하위 변경 요청은 출처·형식·크기를 먼저 검사한다', async () => {
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  let reached = 0
  app.post('/api/organizations/:organizationId/probe', c => { reached++; return c.json({ ok: true }) })
  app.get('/api/organizations/:organizationId/probe', c => c.json({ ok: true }))
  const path = '/api/organizations/a/probe'
  const json = { 'Content-Type': 'application/json' }
  assert.equal((await app.request(path, { method: 'POST', headers: { ...json, Origin: 'https://evil.test' }, body: '{}' })).status, 403)
  assert.equal((await app.request(path, { method: 'POST', headers: json, body: '{}' })).status, 403)
  assert.equal((await app.request(path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415)
  const huge = JSON.stringify({ x: 'a'.repeat(40000) })
  const tooLarge = await app.request(path, { method: 'POST', headers: { ...json, Origin: origin }, body: huge })
  assert.equal(tooLarge.status, 413)
  assert.deepEqual(await tooLarge.json(), { error: 'BODY_TOO_LARGE' })
  // Content-Length 없이 스트림으로 보내도 막는다.
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(huge)); controller.close() } })
  assert.equal((await app.request(path, { method: 'POST', headers: { ...json, Origin: origin }, body: stream, duplex: 'half' } as RequestInit)).status, 413)
  // Content-Length만 보고도 본문을 읽기 전에 막는다.
  assert.equal((await app.request(path, { method: 'POST', headers: { ...json, Origin: origin, 'Content-Length': '40000' }, body: '{}' })).status, 413)
  assert.equal(reached, 0)
  assert.equal((await app.request(path, { method: 'POST', headers: { ...json, Origin: origin }, body: '{}' })).status, 200)
  assert.equal((await app.request(path)).status, 200)
  assert.equal(reached, 1)
})

test('서버 쪽 실패(5xx)인 ApiError·HTTPException은 코드와 상태만 로그에 남기고, 4xx는 남기지 않는다', async (t) => {
  const logged: string[] = []
  t.mock.method(console, 'error', (line: string) => { logged.push(line) })
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  app.get('/api/organizations/:organizationId/provider', () => { throw new ApiError('DELIVERY_PROVIDER_FAILED', 502) })
  app.get('/api/organizations/:organizationId/unavailable', () => { throw new HTTPException(503, { message: 'upstream secret-token' }) })
  app.get('/api/organizations/:organizationId/conflict', () => { throw new ApiError('VERSION_CONFLICT', 409) })
  const failed = await app.request('/api/organizations/org-1/provider')
  assert.equal(failed.status, 502)
  assert.deepEqual(await failed.json(), { error: 'DELIVERY_PROVIDER_FAILED' })
  assert.equal((await app.request('/api/organizations/org-1/unavailable')).status, 503)
  assert.equal((await app.request('/api/organizations/org-1/conflict')).status, 409)
  assert.deepEqual(logged.map(line => JSON.parse(line)), [
    { event: 'request_failed', method: 'GET', route: '/api/organizations/:organizationId/provider', code: 'DELIVERY_PROVIDER_FAILED', status: 502 },
    { event: 'request_failed', method: 'GET', route: '/api/organizations/:organizationId/unavailable', status: 503 },
  ])
  assert.ok(!logged.join('').includes('secret-token'))
})

test('인증 경로도 본문을 읽기 전에 크기를 제한한다', async () => {
  let calls = 0
  const app = createApp({ auth: { handler: async () => { calls++; return new Response('ok') } }, trustedOrigin: origin })
  const path = '/api/auth/sign-in/social'
  const huge = JSON.stringify({ x: 'a'.repeat(40000) })
  const json = { 'Content-Type': 'application/json' }
  const withLength = await app.request(path, { method: 'POST', headers: { ...json, 'Content-Length': String(huge.length) }, body: huge })
  assert.equal(withLength.status, 413)
  assert.deepEqual(await withLength.json(), { error: 'BODY_TOO_LARGE' })
  assert.equal((await app.request(path, { method: 'POST', headers: json, body: huge })).status, 413)
  assert.equal(calls, 0)
  assert.equal((await app.request(path, { method: 'POST', headers: json, body: '{}' })).status, 200)
  assert.equal((await app.request('/api/auth/get-session')).status, 200)
  assert.equal(calls, 2)
})

test('HTTPException은 상태에 맞는 기존 오류 코드로 응답한다', async () => {
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  const expected = [[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [413, 'BODY_TOO_LARGE'], [415, 'UNSUPPORTED_MEDIA_TYPE'], [418, 'REQUEST_FAILED']] as const
  for (const [status] of expected) app.get(`/api/status-${status}`, () => { throw new HTTPException(status) })
  for (const [status, code] of expected) {
    const response = await app.request(`/api/status-${status}`)
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), { error: code })
  }
})

test('로그의 SQLSTATE와 오류 이름은 형식에 맞는 값만 남긴다', async (t) => {
  const logged: string[] = []
  t.mock.method(console, 'error', (line: string) => { logged.push(line) })
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  app.get('/api/errno', () => { throw Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }) })
  app.get('/api/named', () => { const error = new Error('x'); error.name = 'leak secret-token value'; throw error })
  await app.request('/api/errno')
  await app.request('/api/named')
  assert.deepEqual(logged.map(line => JSON.parse(line)), [
    { event: 'request_failed', method: 'GET', route: '/api/errno', error: 'Error' },
    { event: 'request_failed', method: 'GET', route: '/api/named', error: 'Error' },
  ])
})

test('서버 쪽 실패만 오류 수집기로 보내고, 로그와 같은 정제된 필드를 함께 넘긴다', async (t) => {
  t.mock.method(console, 'error', () => {})
  const reported: { error: Error; fields: Record<string, unknown> }[] = []
  setErrorReporter((error, fields) => { reported.push({ error, fields }) })
  t.after(() => setErrorReporter(undefined))
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  const crash = new Error('value=secret-token')
  app.get('/api/organizations/:organizationId/crash', () => { throw crash })
  app.get('/api/organizations/:organizationId/provider', () => { throw new ApiError('DELIVERY_PROVIDER_FAILED', 502) })
  app.get('/api/organizations/:organizationId/conflict', () => { throw new ApiError('VERSION_CONFLICT', 409) })
  await app.request('/api/organizations/org-1/crash')
  await app.request('/api/organizations/org-1/provider')
  await app.request('/api/organizations/org-1/conflict')
  assert.equal(reported.length, 2)
  assert.equal(reported[0]!.error, crash)
  assert.deepEqual(reported[0]!.fields, { event: 'request_failed', method: 'GET', route: '/api/organizations/:organizationId/crash', error: 'Error' })
  assert.deepEqual(reported[1]!.fields, { event: 'request_failed', method: 'GET', route: '/api/organizations/:organizationId/provider', code: 'DELIVERY_PROVIDER_FAILED', status: 502 })
})
