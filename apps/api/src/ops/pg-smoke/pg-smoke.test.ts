import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Db } from '../../db/types.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import { UNSHOWN_TARGET_MESSAGE } from '../migrate/migrate-check.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  createAndJoinCase,
  joinTwiceCase,
  rotateTogetherCase,
  transferAndRemoveCase,
  writePathCase,
  type SmokeCase,
} from './pg-smoke-cases.js'
import { runPgSmoke, serverProblem, smokeDatabaseName, withDatabase } from './pg-smoke.js'
import { createTestDb } from '../../db/test-db.js'

test('DB 이름만 바꾼다: 쿼리, 포트, IPv6, 인코딩된 비밀번호, 사용자는 그대로 둔다', () => {
  const cases: [string, string][] = [
    [
      'postgres://u:p%40ss%2Fw%23rd@ep-a.neon.tech:5432/neondb?sslmode=require&channel_binding=require',
      'postgres://u:p%40ss%2Fw%23rd@ep-a.neon.tech:5432/vada_smoke_x?sslmode=require&channel_binding=require',
    ],
    ['postgres://u:pw@[::1]:6543/db', 'postgres://u:pw@[::1]:6543/vada_smoke_x'],
    ['postgresql://u:pw@h.example/db', 'postgresql://u:pw@h.example/vada_smoke_x'],
    // 경로가 없는 주소도 DB 이름만 더한다.
    ['postgres://u:pw@h.example', 'postgres://u:pw@h.example/vada_smoke_x'],
    ['postgres://u:pw@h.example/', 'postgres://u:pw@h.example/vada_smoke_x'],
  ]
  for (const [from, to] of cases) assert.equal(withDatabase(from, 'vada_smoke_x'), to, from)
})

test('잠깐 쓸 DB 이름은 vada_smoke_<년월일시분초>_<난수 4자>이고, 시각은 UTC다', () => {
  const now = new Date('2026-10-20T03:04:05.678Z')
  assert.match(smokeDatabaseName(now), /^vada_smoke_20261020030405_[0-9a-z]{4}$/)
  assert.equal(smokeDatabaseName(now, 'a1b2'), 'vada_smoke_20261020030405_a1b2')
  // 난수는 실행마다 다르다.
  assert.notEqual(new Set(Array.from({ length: 20 }, () => smokeDatabaseName(now))).size, 1)
})

test('서버는 PostgreSQL 18 이상이고 기본 거래 격리가 read committed여야 한다', () => {
  assert.equal(serverProblem('18.0', 'read committed'), undefined)
  assert.equal(serverProblem('18.2 (Debian 18.2-1.pgdg13+1)', 'read committed'), undefined)
  assert.equal(serverProblem('19.1', 'read committed'), undefined)
  assert.match(serverProblem('17.5', 'read committed') ?? '', /18 이상.*17/)
  assert.match(serverProblem('9.6.24', 'read committed') ?? '', /18 이상.*9/)
  assert.match(serverProblem(undefined, 'read committed') ?? '', /18 이상/)
  assert.match(serverProblem('abc', 'read committed') ?? '', /18 이상/)
  assert.match(serverProblem('18.0', 'repeatable read') ?? '', /read committed.*repeatable read/)
  assert.match(serverProblem('18.0', undefined) ?? '', /read committed/)
  // 버전이 먼저다.
  assert.match(serverProblem('17.0', 'serializable') ?? '', /18 이상/)
})

// 실제 DB에는 닿지 않는다. 관리 연결과 점검 DB 연결은 가짜이고, 불린 순서와 보낸 SQL을 적어 둔다.
const SECRET = 'secret-pw'
const URL_WITH_PASSWORD = `postgres://neon_user:${SECRET}@ep-host.example.tech:5432/neondb?sslmode=require`
const NOW = new Date('2026-10-20T03:04:05Z')

type Setup = {
  databaseUrl?: string | undefined
  version?: string
  isolation?: string
  cases?: readonly SmokeCase[]
  // 관리 연결에서 이 문장(앞부분)이 오면 던진다
  failOn?: { statement: string; error: Error }
  migrate?: (url: string) => Promise<void>
  connectError?: Error
  endError?: Error
  // 점검 DB로 여는 연결을 만든다. 기본은 아무것도 못 하는 가짜다.
  smokeConnection?: () => SmokeConnection
}

function harness(setup: Setup = {}) {
  const events: string[] = []
  const statements: string[] = []
  const lines: string[] = []
  const migrated: string[] = []
  const smokeUrls: string[] = []
  const adminUrl = 'databaseUrl' in setup ? setup.databaseUrl : URL_WITH_PASSWORD
  const fake = (label: string, sqlOf: (text: string) => Record<string, unknown>[]) => ({
    db: {} as Db,
    sql: { unsafe: (text: string) => Promise.resolve().then(() => sqlOf(text)) },
    end: async () => {
      events.push(`end ${label}`)
      if (setup.endError) throw setup.endError
      await Promise.resolve()
    },
  })
  const run = () =>
    runPgSmoke({
      databaseUrl: adminUrl,
      connect: url => {
        if (setup.connectError) throw setup.connectError
        if (url === adminUrl) {
          events.push('connect admin')
          return fake('admin', text => {
            statements.push(text)
            if (text.startsWith('CREATE')) events.push('create')
            if (text.startsWith('DROP')) events.push('drop')
            if (setup.failOn && text.startsWith(setup.failOn.statement)) throw setup.failOn.error
            if (text === 'SHOW server_version') return [{ server_version: setup.version ?? '18.0' }]
            if (text === 'SHOW default_transaction_isolation')
              return [{ default_transaction_isolation: setup.isolation ?? 'read committed' }]
            return []
          })
        }
        smokeUrls.push(url)
        events.push('connect smoke')
        return setup.smokeConnection?.() ?? fake('smoke', () => [])
      },
      migrate: async url => {
        events.push('migrate')
        migrated.push(url)
        await setup.migrate?.(url)
      },
      cases: setup.cases ?? [],
      now: () => NOW,
      log: { info: line => lines.push(line), error: line => lines.push(line) },
    })
  return { events, statements, lines, migrated, smokeUrls, run }
}

const noSecret = (lines: string[]) =>
  assert.ok(
    lines.every(line => !line.includes(SECRET) && !line.includes('postgres://')),
    lines.join('\n'),
  )
const passingCase = (name: string): SmokeCase => ({
  name,
  run: () => Promise.resolve({ ok: true, detail: '좋다' }),
})
const databaseOf = (statements: string[]) =>
  /^CREATE DATABASE "(vada_smoke_\d{14}_[0-9a-z]{4})"$/.exec(
    statements.find(item => item.startsWith('CREATE DATABASE')) ?? '',
  )?.[1]

test('모두 통과하면 0이다: 서버를 확인하고, 점검 DB를 만들어 마이그레이션한 뒤 사례를 돌리고, 지우고, 연결을 닫는다', async () => {
  const seen: string[] = []
  const { events, statements, lines, migrated, smokeUrls, run } = harness({
    cases: [
      passingCase('첫째'),
      {
        name: '둘째',
        run: context => {
          seen.push(`${context.now.toISOString()} ${context.sessionLimitMs}`)
          context.connect()
          return Promise.resolve({ ok: true, detail: '둘째도 좋다' })
        },
      },
    ],
  })
  assert.equal(await run(), 0, lines.join(' | '))
  const name = databaseOf(statements)
  assert.ok(name, statements.join(' | '))
  assert.deepEqual(statements, [
    'SHOW server_version',
    'SHOW default_transaction_isolation',
    `CREATE DATABASE "${name}"`,
    `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
  ])
  // 마이그레이션과 사례는 점검 DB로 이은 주소를 쓴다(비밀번호와 쿼리는 그대로). 사례가 닫지 않은 연결은 지우기 전에 닫는다.
  const smokeUrl = `postgres://neon_user:${SECRET}@ep-host.example.tech:5432/${name}?sslmode=require`
  assert.deepEqual(migrated, [smokeUrl])
  assert.deepEqual(smokeUrls, [smokeUrl])
  assert.deepEqual(seen, [`${NOW.toISOString()} 2000`])
  // 마이그레이션 → 사례 → 연결 닫기 → 지우기 → 관리 연결 닫기 순서다.
  assert.deepEqual(events, [
    'connect admin',
    'create',
    'migrate',
    'connect smoke',
    'end smoke',
    'drop',
    'end admin',
  ])
  assert.ok(lines.includes('대상: ep-host.example.tech/neondb'), lines.join(' | '))
  assert.ok(lines.includes('통과: 첫째 — 좋다'), lines.join(' | '))
  assert.ok(lines.includes('통과: 둘째 — 둘째도 좋다'), lines.join(' | '))
  assert.ok(lines.some(line => line.includes(name)))
  noSecret(lines)
})

test('사례 하나가 실패해도 나머지를 돌리고, 지우고, 1로 끝난다', async () => {
  const { statements, lines, run } = harness({
    cases: [
      {
        name: '깨진 사례',
        run: () => Promise.resolve({ ok: false, detail: '회장 0명', code: 'MISMATCH' }),
      },
      passingCase('멀쩡한 사례'),
    ],
  })
  assert.equal(await run(), 1)
  assert.ok(lines.includes('실패: 깨진 사례 — 회장 0명 (MISMATCH)'), lines.join(' | '))
  assert.ok(lines.includes('통과: 멀쩡한 사례 — 좋다'))
  assert.ok(statements.at(-1)?.startsWith('DROP DATABASE IF EXISTS "vada_smoke_'))
})

test('사례가 던지면 코드만 찍고 원문은 찍지 않는다. 그래도 지우고 1로 끝난다', async () => {
  const { events, statements, lines, run } = harness({
    cases: [
      {
        name: '던지는 사례',
        run: () =>
          Promise.reject(
            Object.assign(new Error(`connect failed ${URL_WITH_PASSWORD}`), { code: '08006' }),
          ),
      },
      passingCase('뒤 사례'),
    ],
  })
  assert.equal(await run(), 1)
  assert.ok(lines.includes('실패: 던지는 사례 — 오류로 끝났다 (08006)'), lines.join(' | '))
  assert.ok(lines.includes('통과: 뒤 사례 — 좋다'))
  noSecret(lines)
  assert.ok(statements.at(-1)?.startsWith('DROP DATABASE'))
  assert.equal(events.at(-1), 'end admin')
})

test('마이그레이션이 실패하면 사례를 돌리지 않고, 지우고, 연결을 닫고 1로 끝난다', async () => {
  let ran = 0
  const { events, statements, lines, run } = harness({
    migrate: () => Promise.reject(Object.assign(new Error(URL_WITH_PASSWORD), { code: '28P01' })),
    cases: [
      {
        name: '돌지 않을 사례',
        run: () => {
          ran += 1
          return Promise.resolve({ ok: true, detail: '' })
        },
      },
    ],
  })
  assert.equal(await run(), 1)
  assert.equal(ran, 0)
  assert.ok(lines.some(line => line.includes('점검 실패') && line.includes('28P01')))
  noSecret(lines)
  assert.ok(statements.at(-1)?.startsWith('DROP DATABASE IF EXISTS'))
  assert.equal(events.at(-1), 'end admin')
})

test('CREATE DATABASE 권한이 없으면(42501) 그 사실만 알리고 2로 끝난다. 지울 것도 없다', async () => {
  const { events, statements, lines, run } = harness({
    failOn: {
      statement: 'CREATE DATABASE',
      error: Object.assign(new Error(`permission denied ${URL_WITH_PASSWORD}`), { code: '42501' }),
    },
    cases: [passingCase('돌지 않을 사례')],
  })
  assert.equal(await run(), 2)
  assert.ok(lines.some(line => line.includes('CREATE DATABASE') && line.includes('42501')))
  assert.ok(!lines.some(line => line.startsWith('통과')))
  noSecret(lines)
  assert.ok(!statements.some(item => item.startsWith('DROP')))
  assert.ok(!events.includes('migrate'))
  assert.equal(events.at(-1), 'end admin')
})

test('CREATE DATABASE가 그 밖의 이유로 실패하면 1이고, 만들어졌을 수 있어 지우기를 시도한다', async () => {
  const { statements, lines, run } = harness({
    failOn: {
      statement: 'CREATE DATABASE',
      error: Object.assign(new Error(URL_WITH_PASSWORD), { code: 'ECONNRESET' }),
    },
  })
  assert.equal(await run(), 1)
  assert.ok(lines.some(line => line.includes('ECONNRESET')))
  noSecret(lines)
  assert.ok(statements.at(-1)?.startsWith('DROP DATABASE IF EXISTS'))
})

test('지우기에 실패하면 그 DB 이름만 찍고 사례가 모두 통과해도 1로 끝난다', async () => {
  const { statements, lines, events, run } = harness({
    failOn: {
      statement: 'DROP DATABASE',
      error: Object.assign(new Error(`still in use ${URL_WITH_PASSWORD}`), { code: '55006' }),
    },
    cases: [passingCase('사례')],
  })
  assert.equal(await run(), 1)
  const name = databaseOf(statements)
  assert.ok(lines.some(line => line.includes('지우지 못했다') && line.includes(name ?? '?')))
  noSecret(lines)
  assert.ok(lines.includes('통과: 사례 — 좋다'))
  assert.equal(events.at(-1), 'end admin')
})

test('서버가 18 미만이거나 거래 격리가 다르면 아무것도 만들지 않고 1로 끝난다', async () => {
  for (const [setup, message] of [
    [{ version: '17.5' }, /18 이상/],
    [{ isolation: 'repeatable read' }, /read committed/],
  ] as const) {
    const { statements, lines, events, run } = harness({ ...setup, cases: [passingCase('사례')] })
    assert.equal(await run(), 1, JSON.stringify(setup))
    assert.ok(
      lines.some(line => message.test(line)),
      lines.join(' | '),
    )
    assert.ok(!statements.some(item => item.startsWith('CREATE') || item.startsWith('DROP')))
    assert.ok(!events.includes('migrate'))
    assert.equal(events.at(-1), 'end admin')
  }
})

test('주소가 없거나 읽히지 않으면 연결하지 않고 1로 끝난다', async () => {
  const missing = harness({ databaseUrl: undefined })
  assert.equal(await missing.run(), 1)
  assert.deepEqual(missing.events, [])
  assert.ok(missing.lines.some(line => line.includes('DATABASE_URL')))
  const unreadable = harness({ databaseUrl: 'postgres://u:pa/ss@h/db' })
  assert.equal(await unreadable.run(), 1)
  assert.deepEqual(unreadable.events, [])
  assert.ok(unreadable.lines.includes(UNSHOWN_TARGET_MESSAGE), unreadable.lines.join(' | '))
  assert.ok(unreadable.lines.every(line => !line.includes('pa/ss')))
})

test('관리 연결이 안 되면 코드만 찍고 1로 끝난다. 지울 것은 없다', async () => {
  const { statements, lines, run } = harness({
    connectError: Object.assign(new Error(`connect ${URL_WITH_PASSWORD}`), {
      code: 'ECONNREFUSED',
    }),
  })
  assert.equal(await run(), 1)
  assert.ok(lines.some(line => line.includes('점검 실패') && line.includes('ECONNREFUSED')))
  noSecret(lines)
  assert.deepEqual(statements, [])
})

test('연결 닫기가 실패해도 결과는 바꾸지 않는다', async () => {
  const { lines, run } = harness({
    endError: new Error(URL_WITH_PASSWORD),
    cases: [
      {
        name: '연결을 열어 두는 사례',
        run: context => {
          context.connect()
          return Promise.resolve({ ok: true, detail: '좋다' })
        },
      },
    ],
    smokeConnection: () => ({
      db: {} as Db,
      sql: { unsafe: () => Promise.resolve([]) },
      end: () => Promise.reject(new Error(URL_WITH_PASSWORD)),
    }),
  })
  assert.equal(await run(), 0)
  noSecret(lines)
})

// PGlite는 연결이 하나이고 거래를 하나씩 돌린다. 아래 시험은 실제 사례(쓰기 길과 동시 처리 네 가지)가 점검 DB에서 도는 모양을
// 순서대로 돌려 확인할 뿐, 동시 처리와 잠금이 실제로 동작하는지는 증명하지 못한다. 마지막 사례(세션 쓰기)는 연결이 둘 이상이어야 뜻이 있어 뺐다.
test('실제 사례를 PGlite 점검 DB에서 순서대로 돌린다(동시성은 증명하지 못한다)', async () => {
  const testDb = await createTestDb()
  try {
    const { lines, statements, run } = harness({
      cases: [
        writePathCase,
        joinTwiceCase,
        rotateTogetherCase,
        transferAndRemoveCase,
        createAndJoinCase,
      ],
      smokeConnection: () => pgliteConnection(testDb),
    })
    assert.equal(await run(), 0, lines.join(' | '))
    assert.equal(lines.filter(line => line.startsWith('통과: ')).length, 5, lines.join(' | '))
    assert.ok(!lines.some(line => line.startsWith('실패')))
    assert.ok(statements.at(-1)?.startsWith('DROP DATABASE IF EXISTS'))
    noSecret(lines)
  } finally {
    await testDb.close()
  }
})
