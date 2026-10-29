import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../src/db/test-db.js'
import { SHOWCASE } from '../src/flows/showcase/content/index.js'
import { fakeStorage } from '../src/test-support/storage.js'
import { parseShowcaseArgs, runShowcaseCommand, type ShowcaseRun } from './showcase-command.js'

const SECRET_URL = 'postgres://user:hunter2@db.example.test/vada'
// 적용 시험의 돌리는 때. 지나간 고정 시각이라 언제 돌려도 그날 아직 오지 않은 단계가 없고(한국 정오) 실제 시각을 넘지 않는다.
const PAST_NOON = new Date('2026-10-29T03:00:00Z')
const DEFAULT_NAMES = { schoolName: SHOWCASE.council.schoolName, name: SHOWCASE.council.name }

test('인자: 회장 계정은 꼭, 나머지 역할 계정과 이름은 골라서, 스위치는 셋만 받는다', () => {
  assert.deepEqual(parseShowcaseArgs(['--president', 'u1']), {
    accounts: { president: 'u1' },
    names: DEFAULT_NAMES,
    apply: false,
    fromShell: false,
  })
  assert.deepEqual(
    parseShowcaseArgs([
      '--apply',
      '--president',
      'u1',
      '--finance-head',
      'u2',
      '--planning-head',
      'u3',
      '--school',
      ' 시험 학교 ',
      '--council',
      '연습 학생회',
      '--from-shell',
    ]),
    {
      accounts: { president: 'u1', financeHead: 'u2', planningHead: 'u3' },
      names: { schoolName: '시험 학교', name: '연습 학생회' },
      apply: true,
      fromShell: true,
    },
  )
  for (const bad of [
    [],
    ['--apply'],
    ['u1'],
    ['--finance-head', 'u2'],
    ['--president'],
    ['--president', '--apply'],
    ['--president', ' '],
    ['--president', 'u1', 'u2'],
    ['--president', 'u1', '--president', 'u2'],
    ['--president', 'u1', '--finance-head', 'u1'],
    ['--president', 'u1', '--aply'],
    ['--president', 'u1', '--apply', '--dry-run'],
    ['--president', 'u1', '--apply', '--apply'],
    ['--president', 'u1', '--school'],
    ['--president', 'u1', '--force'],
  ])
    assert.equal(parseShowcaseArgs(bad), null, bad.join(' '))
})

// 증빙 저장소: 가짜 저장소와, 올리기(PUT)를 받아 객체를 두는 가짜 fetch
function storageDeps() {
  const fake = fakeStorage()
  const fetcher = ((url: string) => {
    fake.put(url.slice('https://r2.test/up/'.length))
    return Promise.resolve(new Response(null, { status: 200 }))
  }) as typeof fetch
  return { storage: fake.storage, fetcher }
}

function harness(overrides: Partial<ShowcaseRun> = {}) {
  const info: string[] = []
  const error: string[] = []
  let connected = 0
  const run: ShowcaseRun = {
    args: ['--president', 'u1'],
    env: {},
    shellUrl: undefined,
    readEnvUrl: () => SECRET_URL,
    connect: () => {
      connected += 1
      throw new Error('connect must not be called')
    },
    storage: storageDeps().storage,
    now: () => new Date(Date.now() - 60_000),
    log: { info: line => info.push(line), error: line => error.push(line) },
    ...overrides,
  }
  return { run, info, error, connected: () => connected }
}

test('미리 보기는 대상과 만들 것만 보이고 연결하지 않으며 비밀 값과 사람 이름을 찍지 않는다', async () => {
  const t = harness({ args: ['--president', 'u1', '--council', "연습 '학생회'"] })
  assert.equal(await runShowcaseCommand(t.run), 0)
  assert.equal(t.connected(), 0)
  const out = [...t.info, ...t.error].join('\n')
  assert.match(out, /대상: db\.example\.test\/vada \(\.env\)/)
  assert.match(out, /실제 계정 자리: 회장 \/ 가상 인물이 맡는 자리: 재정부장, 기획부장/)
  assert.match(out, /운영진 18명.*신청 20\(입금 10\)/)
  assert.match(out, /미리 보기라 바꾸지 않았다/)
  assert.match(
    out,
    /showcase --president u1 --school '서울과학기술대학교' --council '연습 '\\''학생회'\\''' --apply/,
  )
  assert.doesNotMatch(out, /hunter2/)
  for (const person of SHOWCASE.council.staff) assert.doesNotMatch(out, new RegExp(person.name))
})

test('증빙 저장소가 없으면 연결하지 않고 멈춘다', async () => {
  for (const args of [
    ['--president', 'u1'],
    ['--president', 'u1', '--apply'],
  ]) {
    const t = harness({ args, storage: null })
    assert.equal(await runShowcaseCommand(t.run), 1)
    assert.equal(t.connected(), 0)
    assert.match(t.error.join('\n'), /증빙 저장소가 없어/)
  }
})

test('셸 주소와 --from-shell이 어긋나거나, 모르는 인자, npm이 삼킨 --dry-run, 읽지 못한 .env는 연결 전에 멈춘다', async () => {
  for (const overrides of [
    { shellUrl: SECRET_URL, args: ['--president', 'u1', '--apply'] },
    { args: ['--president', 'u1', '--from-shell', '--apply'] },
    { args: ['--president', 'u1', '--aply'] },
    { env: { npm_config_dry_run: 'true' } },
    {
      readEnvUrl: () => {
        throw new Error(`no file ${SECRET_URL}`)
      },
    },
    { args: ['--president', 'u1', '--apply'], readEnvUrl: () => 'postgres://u:p/ss@host/db' },
  ]) {
    const t = harness(overrides)
    assert.equal(await runShowcaseCommand(t.run), 1)
    assert.equal(t.connected(), 0)
    assert.doesNotMatch([...t.info, ...t.error].join('\n'), /hunter2/)
  }
})

test('--from-shell이면 셸의 주소를 대상으로 보여 준다', async () => {
  const t = harness({
    args: ['--president', 'u1', '--from-shell'],
    shellUrl: 'postgres://u:p@prod.example.test/app',
    readEnvUrl: () => {
      throw new Error('env must not be read')
    },
  })
  assert.equal(await runShowcaseCommand(t.run), 0)
  assert.match(t.info.join('\n'), /대상: prod\.example\.test\/app \(셸\)/)
  assert.match(t.info.join('\n'), /--from-shell --apply/)
})

async function googleUser(pg: Awaited<ReturnType<typeof createTestDb>>['pg'], id: string) {
  await pg.query(
    `INSERT INTO users (id, name, email) VALUES ('${id}', '${id}', '${id}@example.test')`,
  )
  await pg.query(
    `INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ('a-${id}', '${id}', 'google', 's-${id}')`,
  )
}
const countOf = async (pg: Awaited<ReturnType<typeof createTestDb>>['pg'], sql: string) =>
  Number(((await pg.query(sql)).rows[0] as { n: string }).n)

test('--apply는 만들고 닫으며, 같은 학교의 같은 이름은 멈추고 다른 이름은 따로 만든다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    await googleUser(pg, 'u2')
    let ended = 0
    const connect = () => ({ db, end: () => Promise.resolve(void (ended += 1)) })
    const deps = storageDeps()
    const args = ['--president', 'u1', '--finance-head', 'u2', '--apply']
    const first = harness({ args, connect, now: () => PAST_NOON, ...deps })
    assert.equal(await runShowcaseCommand(first.run), 0, first.error.join('\n'))
    assert.match(first.info.join('\n'), /준비 완료/)
    const again = harness({ args, connect, now: () => PAST_NOON, ...deps })
    assert.equal(await runShowcaseCommand(again.run), 1)
    assert.match(again.info.join('\n'), /이미 있다/)
    const other = harness({
      args: [...args, '--council', '연습 학생회'],
      connect,
      now: () => PAST_NOON,
      ...deps,
    })
    assert.equal(await runShowcaseCommand(other.run), 0, other.error.join('\n'))
    assert.equal(ended, 3)
    assert.equal(await countOf(pg, 'SELECT count(*) AS n FROM council'), 2)
    assert.equal(await countOf(pg, 'SELECT count(*) AS n FROM event'), SHOWCASE.events.length * 2)
  } finally {
    await close()
  }
})

test('실패하면 오류 원문을 찍지 않고 연결을 닫으며 아무것도 남기지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await pg.query("INSERT INTO users (id, name, email) VALUES ('x', 'x', 'x@example.test')")
    let ended = 0
    const t = harness({
      args: ['--president', 'x', '--apply'],
      connect: () => ({ db, end: () => Promise.resolve(void (ended += 1)) }),
    })
    assert.equal(await runShowcaseCommand(t.run), 1)
    assert.equal(ended, 1)
    const out = t.error.join('\n')
    assert.match(out, /처리 실패/)
    assert.doesNotMatch(out, /Google user is required/)
    assert.equal(await countOf(pg, 'SELECT count(*) AS n FROM council'), 0)
  } finally {
    await close()
  }
})

test('중간 단계(증빙 올리기)에서 실패하면 학생회도 가상 계정도 남지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    const users = await countOf(pg, 'SELECT count(*) AS n FROM users')
    const failing = (() => Promise.resolve(new Response(null, { status: 500 }))) as typeof fetch
    const t = harness({
      args: ['--president', 'u1', '--apply'],
      connect: () => ({ db, end: () => Promise.resolve() }),
      now: () => PAST_NOON,
      fetcher: failing,
    })
    assert.equal(await runShowcaseCommand(t.run), 1)
    assert.match(t.error.join('\n'), /처리 실패/)
    assert.equal(await countOf(pg, 'SELECT count(*) AS n FROM council'), 0)
    assert.equal(await countOf(pg, 'SELECT count(*) AS n FROM users'), users)
  } finally {
    await close()
  }
})
