import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { appModulesOf } from './app-modules.js'
import { createApp } from './app.js'
import { createTestDb, type TestDb } from './db/test-db.js'
import { createPurchaseWriteLimiter } from './purchases/write-limit.js'
import { caller, testSession } from './test-support/http.js'
import { seedCouncil } from './test-support/council.js'

// 앱의 시계를 하루 미뤄 두고 모든 모듈이 그 시각을 쓰는지 본다.
// 모듈이 clock 옵션을 받지 못해 자기 시계(new Date())를 쓰면 시계를 미뤄도 그 모듈만 지금 시각으로 판단한다.
const SHIFTED = new Date(Date.now() + 24 * 60 * 60 * 1000)

const INVITE_CODE = 'ABCD2345'
let testDb: TestDb
let councilId: string
let presidentId: string
before(async () => {
  testDb = await createTestDb()
  const seeded = await seedCouncil(testDb.db, testDb.pg)
  councilId = seeded.councilId
  presidentId = seeded.people.president.userId
  await testDb.pg.query(
    'INSERT INTO invite_code (council_id, code, created_by) VALUES ($1, $2, $3)',
    [councilId, INVITE_CODE, seeded.people.president.memberId],
  )
})
after(() => testDb.close())

const here = (stack: string) => {
  const files = stack.replaceAll(String.fromCharCode(92), '/').split(String.fromCharCode(10))
  return files.filter(
    line =>
      line.includes('/apps/api/src/') &&
      !/\.test\.ts|\/test-support\/|\/db\/test-db/.test(line) &&
      !/app-modules\.test/.test(line),
  )
}

// 인자 없는 new Date()와 Date.now()가 서버 코드(시험 코드가 아닌 apps/api/src)에서 불리면 모은다.
function watchOwnClock() {
  const RealDate = Date
  const calls: string[] = []
  const note = () => {
    const frames = here(new Error().stack ?? '')
    if (frames.length > 0) calls.push(frames[0]!.trim())
  }
  const Watched = new Proxy(RealDate, {
    construct(target, args: unknown[], newTarget) {
      if (args.length === 0) note()
      return Reflect.construct(target, args, newTarget) as object
    },
  })
  const realNow = RealDate.now
  RealDate.now = () => {
    note()
    return realNow.call(RealDate)
  }
  globalThis.Date = Watched
  return {
    calls,
    stop() {
      globalThis.Date = RealDate
      RealDate.now = realNow
    },
  }
}

type Route = { method: string; path: string }
const PARAMS = /:(\w+)/g
const MISSING = '019e0000-0000-7000-8000-000000000000'
const PUSH_BODY = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/probe',
  keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) },
}
type Probe = { method: 'GET' | 'POST'; route: string; path: string; body?: unknown }

// 시계를 읽는 경로를 모듈마다 하나 이상 찾아 보낸다. 읽기는 목록과 하나 읽기의 첫 단계, 읽기가 없는 모듈은 아래 변경 경로다.
function probesOf(app: ReturnType<typeof createApp>): Probe[] {
  const probes = new Map<string, Probe>()
  for (const route of app.routes) {
    if (route.method !== 'GET' || route.path.endsWith('*')) continue
    // 없는 번호로 불러 404가 되는 길에서도 시계는 권한 확인 전에 읽힌다.
    const path = route.path
      .replace(':councilId', councilId)
      .replace(':code', INVITE_CODE)
      .replaceAll(PARAMS, MISSING)
    probes.set(route.path, { method: 'GET', route: route.path, path })
  }
  return [
    ...probes.values(),
    {
      method: 'POST',
      route: '/api/organizations/:councilId/registrations/:registrationId/deposit',
      path: `/api/organizations/${councilId}/registrations/${MISSING}/deposit`,
      body: {},
    },
    { method: 'POST', route: '/api/me/push/test', path: '/api/me/push/test', body: PUSH_BODY },
  ]
}

// 시계를 읽지 않는 모듈. 이유 없이 늘리지 않는다. 내 이름(profile)은 기간에 기대지 않는다(운영진 하나의 이름).
const NO_CLOCK = new Set(['agreement', 'pushDevices', 'profile'])

test('모든 라우트 모듈이 앱의 시계를 쓰고 자기 시계를 만들지 않는다', async () => {
  let calls = 0
  const modules = appModulesOf(testDb.db, testSession, {
    clock: () => {
      calls++
      return SHIFTED
    },
    writeLimiter: createPurchaseWriteLimiter(),
    receiptKey: 'test-receipt-key',
    push: {
      publicKey: 'PUBLIC',
      send: async () => ({ result: 'sent' }),
      wait: async () => {},
      after: () => () => {},
    },
  })
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: 'http://127.0.0.1:5180',
    ...modules,
  })
  // 경로가 어느 모듈 것인지 알려고 모듈마다 따로 앱에 붙여 본다.
  const owner = new Map<string, string>()
  for (const [name, module] of Object.entries(modules)) {
    const hono = module && 'gate' in module ? module.routes : module
    for (const route of (hono as { routes: Route[] }).routes)
      owner.set(`${route.method} /api${route.path}`, name)
  }
  const probes = probesOf(app)
  assert.ok(probes.length > 15, `경로를 ${probes.length}개만 찾았다`)
  const api = caller(app)
  const watch = watchOwnClock()
  const readers = new Set<string>()
  try {
    for (const probe of probes) {
      const before = calls
      const response =
        probe.method === 'GET'
          ? await api.get(probe.path, presidentId)
          : await api.post(probe.path, probe.body, presidentId)
      assert.ok(response.status < 500, `${probe.path}: ${response.status}`)
      const name = owner.get(`${probe.method} ${probe.route}`)
      // 모듈 밖의 경로(상태 확인)는 시계를 읽지 않는다.
      if (name && calls > before) readers.add(name)
    }
  } finally {
    watch.stop()
  }
  assert.deepEqual(watch.calls, [], '앱의 시계 대신 자기 시계를 쓴 곳')
  const silent = Object.keys(modules).filter(name => !NO_CLOCK.has(name) && !readers.has(name))
  assert.deepEqual(silent, [], '앱의 시계를 읽지 않은 모듈. 모듈에 clock을 넘겼는지 본다')
})
