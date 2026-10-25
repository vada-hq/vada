import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb, type TestDb } from '../src/db/test-db.js'
import { seedCouncil } from '../src/test-support/council.js'
import { seedLogins, traceOf, wholeStateOf } from '../src/test-support/withdrawal.js'
import { parsePrivacyArgs, runPrivacy, type PrivacyRun } from './privacy-command.js'

const SECRET_URL = 'postgres://user:hunter2@db.example.test/vada'
// 한국 시각 2026-10-25 12:00. 시험 학생회의 기수는 2026-01-01부터 12-31까지다.
const NOW = new Date('2026-10-25T03:00:00Z')
// 로그인한 지 사흘이 지났다. 명령에는 다시 로그인 검사가 없다.
const LOGGED_IN = new Date('2026-10-22T03:00:00Z')
const EMAIL = 's-planningMember@example.test'

test('인자: withdraw --email <이메일>과 --apply, --dry-run, --from-shell만 받는다', () => {
  assert.deepEqual(parsePrivacyArgs(['withdraw', '--email', 'a@b.test']), {
    command: 'withdraw',
    email: 'a@b.test',
    apply: false,
    fromShell: false,
  })
  assert.deepEqual(
    parsePrivacyArgs(['withdraw', '--apply', '--email', 'a@b.test', '--from-shell']),
    {
      command: 'withdraw',
      email: 'a@b.test',
      apply: true,
      fromShell: true,
    },
  )
  for (const bad of [
    [],
    ['withdraw'],
    ['withdraw', '--email'],
    ['withdraw', '--email', 'not-an-email'],
    ['withdraw', '--email', 'a b@c.test'],
    ['withdraw', 'a@b.test'],
    ['withdraw', '--email', 'a@b.test', '--aply'],
    ['withdraw', '--email', 'a@b.test', '--apply', '--dry-run'],
    ['withdraw', '--email', 'a@b.test', '--apply', '--apply'],
    ['withdraw', '--email', 'a@b.test', 'extra'],
    ['erase', '--email', 'a@b.test'],
  ])
    assert.equal(parsePrivacyArgs(bad), null, bad.join(' '))
})

function harness(overrides: Partial<PrivacyRun> = {}) {
  const info: string[] = []
  const error: string[] = []
  let connected = 0
  let ended = 0
  const run: PrivacyRun = {
    args: ['withdraw', '--email', EMAIL],
    env: {},
    shellUrl: undefined,
    readEnvUrl: () => SECRET_URL,
    connect: () => {
      connected += 1
      throw new Error('connect must not be called')
    },
    now: () => NOW,
    log: { info: line => info.push(line), error: line => error.push(line) },
    ...overrides,
  }
  return {
    run,
    info,
    error,
    out: () => [...info, ...error].join('\n'),
    connected: () => connected,
    ended: () => ended,
    on(testDb: TestDb) {
      run.connect = () => {
        connected += 1
        return { db: testDb.db, end: () => Promise.resolve(void (ended += 1)) }
      }
      return this
    },
  }
}

async function withSeeded(
  run: (testDb: TestDb, council: Awaited<ReturnType<typeof seedCouncil>>) => Promise<void>,
) {
  const testDb = await createTestDb()
  try {
    const council = await seedCouncil(testDb.db, testDb.pg, 's')
    await seedLogins(
      testDb.pg,
      Object.values(council.people).map(person => person.userId),
      LOGGED_IN,
    )
    await run(testDb, council)
  } finally {
    await testDb.close()
  }
}

test('미리 보기는 대상과 개수만 보이고 아무것도 바꾸지 않으며 이메일·비밀 값을 찍지 않는다', () =>
  withSeeded(async testDb => {
    const before = await wholeStateOf(testDb.pg)
    const t = harness().on(testDb)
    assert.equal(await runPrivacy(t.run), 0)
    assert.match(t.out(), /대상: db\.example\.test\/vada \(\.env\)/)
    assert.match(
      t.out(),
      /계정 1, 학생회 소속 1, 부서 소속 1, 운영진 판 1, 알림 기기 1, 세션 1\. 미리 보기라 바꾸지 않았다/,
    )
    assert.doesNotMatch(t.out(), /hunter2|planningMember|@/)
    assert.deepEqual(await wholeStateOf(testDb.pg), before)
    assert.equal(t.ended(), 1)
  }))

test('--apply는 앱의 탈퇴와 같은 결과를 내고, 다시 돌리면 계정이 없어 멈춘다', () =>
  withSeeded(async (testDb, council) => {
    const leaving = council.people.planningMember
    const t = harness({ args: ['withdraw', '--email', EMAIL.toUpperCase(), '--apply'] }).on(testDb)
    assert.equal(await runPrivacy(t.run), 0)
    assert.match(
      t.info.join('\n'),
      /탈퇴 완료: 계정 1, 학생회 소속 1, 부서 소속 1, 운영진 판 1, 알림 기기 1, 세션 1/,
    )
    assert.deepEqual(await traceOf(testDb.pg, leaving.userId, leaving.memberId), {
      users: 0,
      sessions: 0,
      devices: 0,
      accounts: 0,
      logins: 0,
      agreed: 0,
      withdrawn_agreements: 1,
      memberships: 0,
      placements: 0,
      named_versions: 0,
      seats: 0,
      departed: 1,
    })
    const other = council.people.plain
    assert.equal((await traceOf(testDb.pg, other.userId, other.memberId)).users, 1)
    const again = harness({ args: ['withdraw', '--email', EMAIL, '--apply'] }).on(testDb)
    assert.equal(await runPrivacy(again.run), 1)
    assert.match(again.error.join('\n'), /가입한 계정이 없다/)
  }))

test('없는 이메일과 지금 기수의 회장은 미리 보기와 --apply 모두 바꾸지 않고 멈춘다', () =>
  withSeeded(async testDb => {
    const before = await wholeStateOf(testDb.pg)
    for (const [email, reason] of [
      ['nobody@example.test', /가입한 계정이 없다/],
      ['s-president@example.test', /지금 기수의 회장이다/],
    ] as const)
      for (const extra of [[], ['--apply']]) {
        const t = harness({ args: ['withdraw', '--email', email, ...extra] }).on(testDb)
        assert.equal(await runPrivacy(t.run), 1, `${email} ${extra.join(' ')}`)
        assert.match(t.error.join('\n'), reason)
      }
    assert.deepEqual(await wholeStateOf(testDb.pg), before)
  }))

test('셸 주소 규칙, 모르는 인자, npm이 삼킨 --dry-run, 읽지 못한 .env, 보일 수 없는 주소는 연결 전에 멈춘다', async () => {
  for (const overrides of [
    { shellUrl: SECRET_URL },
    { args: ['withdraw', '--email', EMAIL, '--from-shell'] },
    { args: ['withdraw', '--email', EMAIL, '--aply'] },
    { env: { npm_config_dry_run: 'true' } },
    {
      readEnvUrl: () => {
        throw new Error(`no file ${SECRET_URL}`)
      },
    },
    { readEnvUrl: () => 'postgres://u:p/ss@host/db' },
  ] satisfies Partial<PrivacyRun>[]) {
    const t = harness(overrides)
    assert.equal(await runPrivacy(t.run), 1)
    assert.equal(t.connected(), 0)
    assert.doesNotMatch(t.out(), /hunter2/)
  }
})

test('--from-shell이면 셸의 주소를 대상으로 보이고, 실패하면 오류 원문 없이 연결을 닫는다', async () => {
  const t = harness({
    args: ['withdraw', '--email', EMAIL, '--from-shell'],
    shellUrl: 'postgres://u:p@prod.example.test/app',
    readEnvUrl: () => {
      throw new Error('env must not be read')
    },
  })
  let ended = 0
  t.run.connect = () => ({
    db: {
      select: () => {
        throw new Error(`postgres://u:secret@prod.example.test/app failed`)
      },
    } as never,
    end: () => Promise.resolve(void (ended += 1)),
  })
  assert.equal(await runPrivacy(t.run), 1)
  assert.match(t.info.join('\n'), /대상: prod\.example\.test\/app \(셸\)/)
  assert.match(t.error.join('\n'), /처리 실패/)
  assert.doesNotMatch(t.out(), /secret/)
  assert.equal(ended, 1)
})
