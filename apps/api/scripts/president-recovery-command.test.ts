import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb, type TestDb } from '../src/db/test-db.js'
import { seedCouncil } from '../src/test-support/council.js'
import {
  parseRecoveryArgs,
  runPresidentRecovery,
  type RecoveryRun,
} from './president-recovery-command.js'

const SECRET_URL = 'postgres://user:hunter2@db.example.test/vada'
const COUNCIL = '0190a000-0000-7000-8000-000000000001'
const later = new Date('2026-10-25T03:00:00Z')

test('인자: 학생회 번호, 이메일, --notified-on 날짜와 --apply, --from-shell만 받는다', () => {
  assert.deepEqual(parseRecoveryArgs([COUNCIL, 'a@b.test', '--notified-on', '2026-10-10']), {
    councilId: COUNCIL,
    email: 'a@b.test',
    notifiedOn: '2026-10-10',
    apply: false,
    fromShell: false,
  })
  assert.deepEqual(
    parseRecoveryArgs([
      '--from-shell',
      COUNCIL.toUpperCase(),
      '--notified-on',
      '2026-10-10',
      'a@b.test',
      '--apply',
    ]),
    {
      councilId: COUNCIL,
      email: 'a@b.test',
      notifiedOn: '2026-10-10',
      apply: true,
      fromShell: true,
    },
  )
  for (const bad of [
    [],
    [COUNCIL, 'a@b.test'],
    [COUNCIL, 'a@b.test', '--notified-on'],
    [COUNCIL, 'a@b.test', '--notified-on', '--apply'],
    [COUNCIL, 'a@b.test', '--notified-on', '2026-02-30'],
    [COUNCIL, 'a@b.test', '--notified-on', '20261010'],
    [COUNCIL, 'a@b.test', '--notified-on', '2026-10-10', '--notified-on', '2026-10-11'],
    [COUNCIL, 'a@b.test', '--notified-on=2026-10-10'],
    ['not-a-uuid', 'a@b.test', '--notified-on', '2026-10-10'],
    [COUNCIL, 'not-an-email', '--notified-on', '2026-10-10'],
    [COUNCIL, 'a@b.test', 'extra', '--notified-on', '2026-10-10'],
    [COUNCIL, 'a@b.test', '--notified-on', '2026-10-10', '--aply'],
    [COUNCIL, 'a@b.test', '--notified-on', '2026-10-10', '--dry-run'],
    [COUNCIL, 'a@b.test', '--notified-on', '2026-10-10', '--force'],
  ])
    assert.equal(parseRecoveryArgs(bad), null, bad.join(' '))
})

function harness(overrides: Partial<RecoveryRun> = {}) {
  const info: string[] = []
  const error: string[] = []
  let connected = 0
  const run: RecoveryRun = {
    args: [COUNCIL, 'a@b.test', '--notified-on', '2026-10-10'],
    env: {},
    shellUrl: undefined,
    readEnvUrl: () => SECRET_URL,
    connect: () => {
      connected += 1
      throw new Error('connect must not be called')
    },
    now: () => later,
    log: { info: line => info.push(line), error: line => error.push(line) },
    ...overrides,
  }
  return { run, info, error, connected: () => connected, out: () => [...info, ...error].join('\n') }
}

test('모르는 인자, npm이 삼킨 --dry-run, 셸 주소와 --from-shell 어긋남, 읽지 못한 .env, 보일 수 없는 대상은 연결 전에 멈춘다', async () => {
  for (const overrides of [
    { args: [COUNCIL, 'a@b.test', '--notified-on', '2026-10-10', '--aply'] },
    { env: { npm_config_dry_run: 'true' } },
    { shellUrl: SECRET_URL },
    { args: [COUNCIL, 'a@b.test', '--notified-on', '2026-10-10', '--from-shell'] },
    {
      readEnvUrl: () => {
        throw new Error(`no file ${SECRET_URL}`)
      },
    },
    { readEnvUrl: () => 'postgres://u:p/ss@host/db' },
  ] satisfies Partial<RecoveryRun>[]) {
    const t = harness(overrides)
    assert.equal(await runPresidentRecovery(t.run), 1, JSON.stringify(overrides))
    assert.equal(t.connected(), 0)
    assert.match(t.out(), /아무것도 하지 않았다/)
    assert.doesNotMatch(t.out(), /hunter2/)
  }
})

test('--apply인데 이의 기간이 끝나지 않았으면 연결하지 않고 멈춘다', async () => {
  const t = harness({
    args: [COUNCIL, 'a@b.test', '--notified-on', '2026-10-18', '--apply'],
  })
  assert.equal(await runPresidentRecovery(t.run), 1)
  assert.equal(t.connected(), 0)
  assert.match(t.out(), /이의 기간/)
})

// PGlite를 감싼 연결. 닫은 횟수를 센다.
function connectionTo(testDb: TestDb) {
  let ended = 0
  return {
    connect: () => ({ db: testDb.db, end: () => Promise.resolve(void (ended += 1)) }),
    ended: () => ended,
  }
}

// 학생회 소속의 판 수. seedCouncil은 방을 두지 않아 적용이 방을 만들며 방의 판도 늘므로 소속 판만 센다.
const versionCount = async (testDb: TestDb) =>
  Number(
    (
      (
        await testDb.pg.query(
          'SELECT count(*) AS n FROM record_version v JOIN council_membership cm ON cm.id = v.record_id',
        )
      ).rows[0] as { n: string }
    ).n,
  )

test('미리 보기는 대상, 학생회, 지금 회장과 새 회장, 점검과 적용 명령을 보이고 쓰지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const seeded = await seedCouncil(testDb.db, testDb.pg, 's')
    const connection = connectionTo(testDb)
    const before = await versionCount(testDb)
    const t = harness({
      args: [seeded.councilId, 's-plain@example.test', '--notified-on', '2026-10-10'],
      connect: connection.connect,
    })
    assert.equal(await runPresidentRecovery(t.run), 0)
    const out = t.out()
    assert.match(out, /대상: db\.example\.test\/vada \(\.env\)/)
    assert.match(out, /학생회: s 학생회/)
    assert.match(out, /지금 회장: s president/)
    assert.match(out, /새 회장: s plain \(s-plain@example\.test\)/)
    assert.match(out, /2026-10-17/)
    assert.match(out, /미리 보기라 바꾸지 않았다/)
    assert.ok(
      out.includes(
        `pnpm --filter @vada/api president-recovery ${seeded.councilId} s-plain@example.test --notified-on 2026-10-10 --apply`,
      ),
    )
    assert.doesNotMatch(out, /hunter2/)
    assert.equal(await versionCount(testDb), before)
    assert.equal(connection.ended(), 1)
  } finally {
    await testDb.close()
  }
})

test('미리 보기에서 점검이 실패하면 까닭을 보이고 1로 끝난다', async () => {
  const testDb = await createTestDb()
  try {
    const seeded = await seedCouncil(testDb.db, testDb.pg, 's')
    for (const [email, notifiedOn, reason] of [
      ['s-ended@example.test', '2026-10-10', /지금 기수 운영진이 아니다/],
      ['s-president@example.test', '2026-10-10', /이미 회장이다/],
      ['nobody@example.test', '2026-10-10', /그 이메일의 계정이 없다/],
      ['s-plain@example.test', '2026-10-18', /이의 기간이 끝나지 않았다/],
    ] as const) {
      const connection = connectionTo(testDb)
      const t = harness({
        args: [seeded.councilId, email, '--notified-on', notifiedOn],
        connect: connection.connect,
      })
      assert.equal(await runPresidentRecovery(t.run), 1, email)
      assert.match(t.error.join('\n'), reason)
      assert.doesNotMatch(t.out(), /미리 보기라 바꾸지 않았다/)
      assert.equal(connection.ended(), 1)
    }
  } finally {
    await testDb.close()
  }
})

test('--apply는 옮기고 결과를 보이며 연결을 닫는다. 점검이 실패하면 쓰지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const seeded = await seedCouncil(testDb.db, testDb.pg, 's')
    const failing = connectionTo(testDb)
    const before = await versionCount(testDb)
    const stopped = harness({
      args: [seeded.councilId, 's-ended@example.test', '--notified-on', '2026-10-10', '--apply'],
      connect: failing.connect,
    })
    assert.equal(await runPresidentRecovery(stopped.run), 1)
    assert.equal(await versionCount(testDb), before)
    assert.equal(failing.ended(), 1)
    const connection = connectionTo(testDb)
    const t = harness({
      args: [seeded.councilId, 's-plain@example.test', '--notified-on', '2026-10-10', '--apply'],
      connect: connection.connect,
    })
    assert.equal(await runPresidentRecovery(t.run), 0)
    assert.match(t.out(), /회장 옮김 완료: s president → s plain/)
    assert.equal(await versionCount(testDb), before + 2)
    assert.equal(connection.ended(), 1)
  } finally {
    await testDb.close()
  }
})

test('DB에서 실패하면 오류 원문을 찍지 않고 연결을 닫는다', async () => {
  let ended = 0
  const t = harness({
    connect: () => ({
      db: {
        transaction: () => Promise.reject(new Error(`boom ${SECRET_URL}`)),
        select: () => {
          throw new Error(`boom ${SECRET_URL}`)
        },
      } as never,
      end: () => Promise.resolve(void (ended += 1)),
    }),
  })
  assert.equal(await runPresidentRecovery(t.run), 1)
  assert.equal(ended, 1)
  assert.match(t.error.join('\n'), /처리 실패/)
  assert.doesNotMatch(t.out(), /boom|hunter2/)
})
