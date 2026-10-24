import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../src/db/test-db.js'
import { parseDemoArgs, runDemo, type DemoRun } from './demo-command.js'

const SECRET_URL = 'postgres://user:hunter2@db.example.test/vada'

test('인자: 계정 번호 하나와 --apply, --dry-run, --from-shell만 받는다', () => {
  assert.deepEqual(parseDemoArgs(['u1']), { userId: 'u1', apply: false, fromShell: false })
  assert.deepEqual(parseDemoArgs(['u1', '--apply', '--from-shell']), {
    userId: 'u1',
    apply: true,
    fromShell: true,
  })
  assert.equal(parseDemoArgs(['--apply', 'u1'])?.userId, 'u1')
  for (const bad of [
    [],
    ['--apply'],
    ['u1', 'u2'],
    ['u1', '--aply'],
    ['u1', '--apply', '--dry-run'],
    ['u1', '--force'],
    [' '],
  ])
    assert.equal(parseDemoArgs(bad), null, bad.join(' '))
})

function harness(overrides: Partial<DemoRun> = {}) {
  const info: string[] = []
  const error: string[] = []
  let connected = 0
  const run: DemoRun = {
    args: ['u1'],
    env: {},
    shellUrl: undefined,
    readEnvUrl: () => SECRET_URL,
    connect: () => {
      connected += 1
      throw new Error('connect must not be called')
    },
    now: () => new Date('2026-10-22T03:00:00Z'),
    log: { info: line => info.push(line), error: line => error.push(line) },
    ...overrides,
  }
  return { run, info, error, connected: () => connected }
}

test('미리 보기는 대상과 넣을 것만 보이고 연결하지 않으며 비밀 값을 찍지 않는다', async () => {
  const t = harness()
  assert.equal(await runDemo(t.run), 0)
  assert.equal(t.connected(), 0)
  const out = [...t.info, ...t.error].join('\n')
  assert.match(out, /대상: db\.example\.test\/vada \(\.env\)/)
  assert.match(out, /미리 보기라 바꾸지 않았다/)
  assert.match(out, /--filter @vada\/api demo u1 --apply/)
  assert.doesNotMatch(out, /hunter2/)
})

test('셸에 DATABASE_URL이 있는데 --from-shell이 없으면 멈춘다', async () => {
  const t = harness({ shellUrl: SECRET_URL, args: ['u1', '--apply'] })
  assert.equal(await runDemo(t.run), 1)
  assert.equal(t.connected(), 0)
  assert.match(t.error.join('\n'), /--from-shell/)
  assert.doesNotMatch(t.error.join('\n'), /hunter2/)
})

test('--from-shell인데 셸에 주소가 없으면 멈춘다', async () => {
  const t = harness({ args: ['u1', '--from-shell', '--apply'] })
  assert.equal(await runDemo(t.run), 1)
  assert.equal(t.connected(), 0)
})

test('--from-shell이면 셸의 주소를 대상으로 보여 준다', async () => {
  const t = harness({
    args: ['u1', '--from-shell'],
    shellUrl: 'postgres://u:p@prod.example.test/app',
    readEnvUrl: () => {
      throw new Error('env must not be read')
    },
  })
  assert.equal(await runDemo(t.run), 0)
  assert.match(t.info.join('\n'), /대상: prod\.example\.test\/app \(셸\)/)
  assert.match(t.info.join('\n'), /u1 --from-shell --apply/)
})

test('모르는 인자와 npm이 삼킨 --dry-run과 읽지 못한 .env는 연결 전에 멈춘다', async () => {
  for (const overrides of [
    { args: ['u1', '--aply'] },
    { env: { npm_config_dry_run: 'true' } },
    {
      readEnvUrl: () => {
        throw new Error(`no file ${SECRET_URL}`)
      },
    },
  ]) {
    const t = harness(overrides)
    assert.equal(await runDemo(t.run), 1)
    assert.equal(t.connected(), 0)
    assert.doesNotMatch(t.error.join('\n'), /hunter2/)
  }
})

test('주소를 화면에 보일 수 없으면 적용하지 않는다', async () => {
  const t = harness({ args: ['u1', '--apply'], readEnvUrl: () => 'postgres://u:p/ss@host/db' })
  assert.equal(await runDemo(t.run), 1)
  assert.equal(t.connected(), 0)
})

test('--apply는 넣고 닫으며, 다시 돌리면 이미 있다로 멈춘다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await pg.query("INSERT INTO users (id, name, email) VALUES ('u1', 'u1', 'u1@example.test')")
    await pg.query(
      "INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ('a1', 'u1', 'google', 's1')",
    )
    let ended = 0
    const connect = () => ({ db, end: () => Promise.resolve(void (ended += 1)) })
    const first = harness({ args: ['u1', '--apply'], connect })
    assert.equal(await runDemo(first.run), 0)
    assert.match(first.info.join('\n'), /준비 완료/)
    const second = harness({ args: ['u1', '--apply'], connect })
    assert.equal(await runDemo(second.run), 0)
    assert.match(second.info.join('\n'), /이미 있다/)
    assert.equal(ended, 2)
    assert.equal(
      Number(((await pg.query('SELECT count(*) AS n FROM event')).rows[0] as { n: string }).n),
      3,
    )
  } finally {
    await close()
  }
})

test('실패하면 오류 원문을 찍지 않고 연결을 닫는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await pg.query("INSERT INTO users (id, name, email) VALUES ('x', 'x', 'x@example.test')")
    let ended = 0
    const t = harness({
      args: ['x', '--apply'],
      connect: () => ({ db, end: () => Promise.resolve(void (ended += 1)) }),
    })
    assert.equal(await runDemo(t.run), 1)
    assert.equal(ended, 1)
    const out = t.error.join('\n')
    assert.match(out, /처리 실패/)
    assert.doesNotMatch(out, /Google user is required/)
  } finally {
    await close()
  }
})
