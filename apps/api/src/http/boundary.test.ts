import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { createApp, type AppOptions } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createPushRoutes } from '../push/routes.js'
import { bodyLimitOf, MAX_BODY_BYTES } from './guard.js'
import { json } from './validate.js'
import type { Db } from '../records/records.js'

// 공통 가드가 거는 곳: 로그인한 구성원의 경로, 로그인한 사람 자신의 경로(휴대폰 알림), 로그인 없이 쓰는 공개 경로
const guarded = ['/api/organizations/', '/api/me/', '/api/public/']
const isGuarded = (path: string) => guarded.some(prefix => path.startsWith(prefix))
// 공통 가드 밖의 변경 라우트. 새 항목은 가드를 대신할 자체 검사가 있어야 한다.
const outsideGuard = new Map([
  ['ALL /api/auth/*', '인증 본문 크기 제한 미들웨어'],
  ['POST /api/auth/*', 'better-auth가 출처를 직접 검사한다'],
])
const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])

test('모든 변경 라우트는 출처·형식·크기·JSON·모르는 키를 인증 전에 거절한다', async () => {
  const origin = 'http://127.0.0.1:5180'
  let authCalls = 0
  const session = async () => { authCalls++; return null }
  // 경계 검사는 DB에 닿기 전에 끝난다. 라우트가 DB를 건드리면 500이 나 아래 상태 검사가 실패한다.
  const db = {} as Db
  // AppOptions에 모듈이 추가되면 여기서 타입 오류가 나므로 이 테스트에서 빠질 수 없다.
  const modules = {
    councils: createCouncilRoutes(db, session),
    push: createPushRoutes(session, 'PUBLIC', async () => ({ result: 'sent' }), async () => {}),
  } satisfies Required<Omit<AppOptions, 'auth' | 'trustedOrigin'>>
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, ...modules })
  const writes = [...new Set(app.routes.filter(route => !readOnly.has(route.method)).map(route => `${route.method} ${route.path}`))]
  const pathOf = (key: string) => key.slice(key.indexOf(' ') + 1)
  for (const key of writes) {
    assert.ok(isGuarded(pathOf(key)) || outsideGuard.has(key), `${key}: 공통 가드 밖의 변경 라우트는 outsideGuard에 이유와 함께 적는다`)
  }
  for (const key of outsideGuard.keys()) assert.ok(writes.includes(key), `${key}: 없는 라우트가 outsideGuard에 남아 있다`)
  // 미들웨어 등록(/*)은 빼고 실제 라우트만 검사한다.
  const mutating = writes.filter(key => isGuarded(pathOf(key)) && !key.endsWith('/*'))
  // 목록이 비어 테스트가 저절로 통과하는 일을 막는다. 변경 라우트를 더하면 이 수도 올린다.
  assert.ok(mutating.length >= 2, `변경 라우트 ${mutating.length}개`)
  for (const key of mutating) {
    const registered = key.slice(0, key.indexOf(' '))
    // app.all()로 등록한 라우트는 POST로 확인한다.
    const method = registered === 'ALL' ? 'POST' : registered
    const path = pathOf(key).replace(/:[^/]+/g, 'probe')
    const send = (headers: Record<string, string>, body: string) => app.request(path, { method, headers, body })
    const jsonHeaders = { 'Content-Type': 'application/json', Origin: origin }
    assert.equal((await send({ ...jsonHeaders, Origin: 'https://evil.test' }, '{}')).status, 403, key)
    assert.equal((await send({ Origin: origin, 'Content-Type': 'text/plain' }, '{}')).status, 415, key)
    // 본문 상한은 경로마다 가드가 정한다. 그 상한을 넘으면 413이다.
    const limit = bodyLimitOf(path)
    assert.equal((await send(jsonHeaders, JSON.stringify({ x: 'a'.repeat(limit + 8) }))).status, 413, key)
    if (limit > MAX_BODY_BYTES) assert.notEqual((await send(jsonHeaders, JSON.stringify({ x: 'a'.repeat(MAX_BODY_BYTES + 8) }))).status, 413, key)
    const before = authCalls
    const malformed = await send(jsonHeaders, '{')
    assert.equal(malformed.status, 400, key)
    assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' }, key)
    assert.equal((await send(jsonHeaders, '{"__probe":1}')).status, 400, key)
    assert.equal(authCalls, before, `${key}: 형식 검사가 인증보다 먼저여야 한다`)
  }
})

test('본문 상한은 가드 한 곳에서 경로마다 정한다: 학생회비 명단은 1 MiB, 회고 저장은 64 KiB이다', () => {
  assert.equal(bodyLimitOf('/api/organizations/a/dues-roster'), 1_048_576)
  assert.equal(bodyLimitOf('/api/organizations/a/events/e/report/retrospective'), 65_536)
  for (const path of ['/api/organizations/a/dues-roster/delete', '/api/organizations/a/expenses', '/api/public/registrations/lookup',
    '/api/organizations/a/b/dues-roster', '/api/organizations//dues-roster', '/api/organizations/a/events/e/report',
    '/api/organizations/a/events/e/report/retrospective/generate', '/api/organizations/a/events/e/report/retrospective/confirm',
    '/api/organizations/a/events//report/retrospective', '/api/organizations/a/events/e/report/retrospectives']) {
    assert.equal(bodyLimitOf(path), MAX_BODY_BYTES, path)
  }
})

test('json()은 모르는 키를 조용히 버리는 스키마를 라우트 생성 시점에 거부한다', () => {
  assert.throws(() => json(z.object({ title: z.string() })))
  assert.throws(() => json(z.looseObject({ title: z.string() })))
  assert.doesNotThrow(() => json(z.strictObject({ title: z.string() })))
})
