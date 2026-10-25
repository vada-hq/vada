import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import { termsGate } from '../agreement/gate.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { bodyLimitOf, MAX_BODY_BYTES } from './guard.js'
import { json } from './validate.js'
import type { Db } from '../db/types.js'

// 공통 가드가 거는 곳: 로그인한 구성원의 경로, 로그인한 사람 자신의 경로(휴대폰 알림), 로그인 없이 쓰는 공개 경로
const guarded = ['/api/organizations/', '/api/me/', '/api/public/']
const isGuarded = (path: string) => guarded.some(prefix => path.startsWith(prefix))
// 공통 가드 밖의 변경 라우트. 새 항목은 가드를 대신할 자체 검사가 있어야 한다.
const outsideGuard = new Map([
  ['ALL /api/auth/*', '인증 본문 크기 제한 미들웨어'],
  ['POST /api/auth/*', 'better-auth가 출처를 직접 검사한다'],
])
const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])

const origin = 'http://127.0.0.1:5180'
// 경계 검사가 보는 변경 라우트 수. 라우트를 더하거나 빼면 이 수를 맞춘다. 모듈 하나가 앱에서 빠지면 수가 줄어 아래 시험이 실패한다.
const MUTATING_ROUTES = 69

// 경계 검사는 DB에 닿기 전에 끝난다. 라우트가 DB를 건드리면 500이 나 아래 상태 검사가 실패한다.
// 모듈 목록은 운영 서버와 같은 appModulesOf 한 곳에 있다. AppOptions에 모듈이 추가되면 거기서 타입 오류가 난다.
function modulesOf(session: () => Promise<null>) {
  return appModulesOf({} as Db, session, {
    clock: () => new Date(),
    writeLimiter: createPurchaseWriteLimiter(),
    receiptKey: 'test-receipt-key',
    push: {
      publicKey: 'PUBLIC',
      send: async () => ({ result: 'sent' }),
      wait: async () => {},
      after: () => () => {},
    },
  })
}
const appOf = (modules: Partial<ReturnType<typeof modulesOf>>) =>
  createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, ...modules })

// 미들웨어 등록(/*)은 빼고 실제 변경 라우트만 센다.
const pathOf = (key: string) => key.slice(key.indexOf(' ') + 1)
const writesOf = (app: ReturnType<typeof appOf>) => [
  ...new Set(
    app.routes
      .filter(route => !readOnly.has(route.method))
      .map(route => `${route.method} ${route.path}`),
  ),
]
const mutatingOf = (writes: string[]) =>
  writes.filter(key => isGuarded(pathOf(key)) && !key.endsWith('/*'))

test('경계 검사가 보는 변경 라우트 수가 맞고, 모듈 하나가 빠지면 줄어든다', () => {
  const modules = modulesOf(async () => null)
  assert.equal(mutatingOf(writesOf(appOf(modules))).length, MUTATING_ROUTES)
  for (const name of Object.keys(modules) as (keyof typeof modules)[]) {
    const { [name]: _omitted, ...rest } = modules
    // 읽기만 있는 모듈(공개 양식 읽기)도 빠지면 모르게 되지 않도록 경로 전체로 센다. 변경 라우트가 더해지는 순간 위 수 검사가 잡는다.
    assert.ok(
      appOf(rest).routes.length < appOf(modules).routes.length,
      `${name}: 이 모듈이 빠져도 경계 검사가 모릅니다`,
    )
  }
})

test('모든 변경 라우트는 출처·형식·크기·JSON·모르는 키를 인증 전에 거절한다', async () => {
  let authCalls = 0
  const session = async () => {
    authCalls++
    return null
  }
  const app = appOf(modulesOf(session))
  const writes = writesOf(app)
  for (const key of writes) {
    assert.ok(
      isGuarded(pathOf(key)) || outsideGuard.has(key),
      `${key}: 공통 가드 밖의 변경 라우트는 outsideGuard에 이유와 함께 적는다`,
    )
  }
  for (const key of outsideGuard.keys())
    assert.ok(writes.includes(key), `${key}: 없는 라우트가 outsideGuard에 남아 있다`)
  const mutating = mutatingOf(writes)
  assert.equal(mutating.length, MUTATING_ROUTES)
  for (const key of mutating) {
    const registered = key.slice(0, key.indexOf(' '))
    // app.all()로 등록한 라우트는 POST로 확인한다.
    const method = registered === 'ALL' ? 'POST' : registered
    const path = pathOf(key).replace(/:[^/]+/g, 'probe')
    const send = (headers: Record<string, string>, body: string) =>
      app.request(path, { method, headers, body })
    const jsonHeaders = { 'Content-Type': 'application/json', Origin: origin }
    assert.equal(
      (await send({ ...jsonHeaders, Origin: 'https://evil.test' }, '{}')).status,
      403,
      key,
    )
    assert.equal(
      (await send({ Origin: origin, 'Content-Type': 'text/plain' }, '{}')).status,
      415,
      key,
    )
    // 본문 상한은 경로마다 가드가 정한다. 그 상한을 넘으면 413이다.
    const limit = bodyLimitOf(path)
    assert.equal(
      (await send(jsonHeaders, JSON.stringify({ x: 'a'.repeat(limit + 8) }))).status,
      413,
      key,
    )
    if (limit > MAX_BODY_BYTES)
      assert.notEqual(
        (await send(jsonHeaders, JSON.stringify({ x: 'a'.repeat(MAX_BODY_BYTES + 8) }))).status,
        413,
        key,
      )
    const before = authCalls
    const malformed = await send(jsonHeaders, '{')
    assert.equal(malformed.status, 400, key)
    assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' }, key)
    assert.equal((await send(jsonHeaders, '{"__probe":1}')).status, 400, key)
    assert.equal(authCalls, before, `${key}: 형식 검사가 인증보다 먼저여야 한다`)
  }
})

test('본문 상한은 가드 한 곳에서 경로마다 정한다: 학생회비 명단은 1 MiB, 회고 저장은 64 KiB, 구매 요청은 192 KiB이다', () => {
  assert.equal(bodyLimitOf('/api/organizations/a/purchase-requests'), 196_608)
  assert.equal(bodyLimitOf('/api/organizations/a/purchase-requests/b/cancel'), MAX_BODY_BYTES)
  assert.equal(bodyLimitOf('/api/organizations/a/fee-payments'), 1_048_576)
  assert.equal(bodyLimitOf('/api/organizations/a/events/e/report/retrospective'), 65_536)
  for (const path of [
    '/api/organizations/a/fee-payments/b/remove',
    '/api/organizations/a/expenses',
    '/api/public/registrations/lookup',
    '/api/organizations/a/b/fee-payments',
    '/api/organizations//fee-payments',
    '/api/organizations/a/events/e/report',
    '/api/organizations/a/events/e/report/retrospective/generate',
    '/api/organizations/a/events/e/report/retrospective/confirm',
    '/api/organizations/a/events//report/retrospective',
    '/api/organizations/a/events/e/report/retrospectives',
  ]) {
    assert.equal(bodyLimitOf(path), MAX_BODY_BYTES, path)
  }
})

test('json()은 모르는 키를 조용히 버리는 스키마를 라우트 생성 시점에 거부한다', () => {
  assert.throws(() => json(z.object({ title: z.string() })))
  assert.throws(() => json(z.looseObject({ title: z.string() })))
  assert.doesNotThrow(() => json(z.strictObject({ title: z.string() })))
})

// 동의 전 막기는 접두어로 건다. 지금 판에 동의하지 않은 계정은 /api/organizations/ 아래 어떤 경로도 쓰지 못한다.
// 경로를 하나씩 적지 않고 앱이 가진 경로를 모두 돌아, 새 경로가 더해져도 막기에서 빠지지 않는지 본다.
test('동의하지 않은 계정은 /api/organizations/ 아래 모든 경로가 403 TERMS_REQUIRED이고 DB에 닿지 않는다', async () => {
  const session = async () => ({ user: { id: 'u1' } })
  const terms = {
    termsVersion: '2026-11-01',
    privacyVersion: '2026-11-01',
    termsUrl: 'https://vada.example.test/terms',
    privacyUrl: 'https://vada.example.test/privacy',
  }
  const modules = modulesOf(async () => null)
  const app = appOf({
    ...modules,
    agreement: {
      routes: modules.agreement.routes,
      gate: termsGate(session, async () => false, terms),
    },
  })
  const keys = [
    ...new Set(
      app.routes
        .filter(route => route.path.startsWith('/api/organizations/') && !route.path.endsWith('/*'))
        .map(route => `${route.method === 'ALL' ? 'POST' : route.method} ${route.path}`),
    ),
  ]
  assert.ok(keys.length > 40, `경로를 ${keys.length}개만 찾았다. 모두 도는지 확인한다`)
  for (const key of keys) {
    const method = key.slice(0, key.indexOf(' '))
    const path = pathOf(key).replace(/:[^/]+/g, 'probe')
    const response = await app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: origin },
      ...(method === 'GET' ? {} : { body: '{}' }),
    })
    assert.equal(response.status, 403, key)
    assert.deepEqual(await response.json(), { error: 'TERMS_REQUIRED' }, key)
  }
})
