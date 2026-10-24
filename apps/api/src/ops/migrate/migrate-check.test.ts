import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import {
  checkTarget,
  describeTarget,
  localMigrations,
  parseMigrateArgs,
  readTargetState,
  targetSourceOf,
} from './migrate-check.js'
import { createTestDb, migrationsFolder } from '../../db/test-db.js'

const local = [
  { hash: 'a', folderMillis: 1 },
  { hash: 'b', folderMillis: 2 },
]

test('기록이 없는 DB는 비어 있어야 적용한다', () => {
  assert.deepEqual(checkTarget({ publicTables: 0, applied: null }, local), { ok: true, pending: 2 })
  assert.deepEqual(checkTarget({ publicTables: 3, applied: null }, local), {
    ok: false,
    reason: 'NOT_EMPTY',
  })
})

test('기록 표만 있고 줄이 없어도 빈 DB일 때만 적용한다', () => {
  assert.deepEqual(checkTarget({ publicTables: 0, applied: [] }, local), { ok: true, pending: 2 })
  assert.deepEqual(checkTarget({ publicTables: 3, applied: [] }, local), {
    ok: false,
    reason: 'NOT_EMPTY',
  })
})

test('기록이 있으면 로컬과 순서·해시·시각이 같아야 하고, 남은 것만 적용한다', () => {
  assert.deepEqual(
    checkTarget({ publicTables: 52, applied: [{ hash: 'a', createdAt: 1 }] }, local),
    { ok: true, pending: 1 },
  )
  assert.deepEqual(
    checkTarget(
      {
        publicTables: 52,
        applied: [
          { hash: 'a', createdAt: 1 },
          { hash: 'b', createdAt: 2 },
        ],
      },
      local,
    ),
    { ok: true, pending: 0 },
  )
  for (const applied of [
    [{ hash: 'x', createdAt: 1 }],
    [{ hash: 'a', createdAt: 9 }],
    [{ hash: 'b', createdAt: 2 }],
    [
      { hash: 'a', createdAt: 1 },
      { hash: 'b', createdAt: 2 },
      { hash: 'c', createdAt: 3 },
    ],
  ]) {
    assert.deepEqual(
      checkTarget({ publicTables: 52, applied }, local),
      { ok: false, reason: 'HISTORY_MISMATCH' },
      JSON.stringify(applied),
    )
  }
})

test('대상은 .env가 기본이고, 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다. 어긋나면 멈춘다', () => {
  const url = 'postgres://vada:secret@host/vada'
  assert.deepEqual(targetSourceOf(false, undefined), { source: '.env' })
  assert.deepEqual(targetSourceOf(false, '   '), { source: '.env' })
  assert.deepEqual(targetSourceOf(true, ` ${url} `), { source: 'shell', url })
  assert.deepEqual(targetSourceOf(false, url), { stop: 'SHELL_URL_WITHOUT_FLAG' })
  assert.deepEqual(targetSourceOf(true, undefined), { stop: 'FLAG_WITHOUT_SHELL_URL' })
  assert.deepEqual(targetSourceOf(true, ''), { stop: 'FLAG_WITHOUT_SHELL_URL' })
})

test('마이그레이션을 적용한 DB의 상태를 읽으면 로컬과 같고 남은 것이 없다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const state = await readTargetState(
      async text => (await pg.query<Record<string, unknown>>(text)).rows,
    )
    assert.equal(state.publicTables, 57)
    assert.deepEqual(checkTarget(state, localMigrations(migrationsFolder)), {
      ok: true,
      pending: 0,
    })
  } finally {
    await close()
  }
})

test('대상 설명에는 호스트와 DB 이름만 나온다', () => {
  assert.equal(
    describeTarget(
      'postgres://vada:secret-password@ep-cool-1234.ap-southeast-1.aws.neon.tech/vada?sslmode=require',
    ),
    'ep-cool-1234.ap-southeast-1.aws.neon.tech/vada',
  )
  assert.ok(!describeTarget('postgres://vada:secret-password@host/db').includes('secret'))
  assert.equal(describeTarget('not a url'), '(주소를 읽지 못했다)')
})

test('로컬 마이그레이션 시각이 커지는 순서가 아니면 멈춘다(drizzle이 시각이 앞선 것을 건너뛴다)', () => {
  for (const bad of [
    [
      { hash: 'a', folderMillis: 2 },
      { hash: 'b', folderMillis: 2 },
    ],
    [
      { hash: 'a', folderMillis: 3 },
      { hash: 'b', folderMillis: 2 },
    ],
  ]) {
    assert.deepEqual(
      checkTarget({ publicTables: 0, applied: null }, bad),
      { ok: false, reason: 'LOCAL_ORDER' },
      JSON.stringify(bad),
    )
    assert.deepEqual(
      checkTarget(
        { publicTables: 52, applied: [{ hash: 'a', createdAt: bad[0]!.folderMillis }] },
        bad,
      ),
      { ok: false, reason: 'LOCAL_ORDER' },
    )
  }
  assert.deepEqual(checkTarget({ publicTables: 0, applied: null }, []), { ok: true, pending: 0 })
  assert.deepEqual(
    checkTarget({ publicTables: 0, applied: null }, [{ hash: 'a', folderMillis: 1 }]),
    { ok: true, pending: 1 },
  )
})

test('실제 로컬 마이그레이션은 시각이 엄격히 커진다', () => {
  const millis = localMigrations(migrationsFolder).map(item => item.folderMillis)
  assert.ok(millis.length > 0)
  assert.ok(millis.every((value, index) => index === 0 || value > millis[index - 1]!))
})

test('인자는 --apply, --dry-run, --from-shell뿐이고 기본은 미리 보기다', () => {
  assert.deepEqual(parseMigrateArgs([], {}), { apply: false, fromShell: false })
  assert.deepEqual(parseMigrateArgs(['--dry-run'], {}), { apply: false, fromShell: false })
  assert.deepEqual(parseMigrateArgs(['--apply'], {}), { apply: true, fromShell: false })
  assert.deepEqual(parseMigrateArgs(['--from-shell'], {}), { apply: false, fromShell: true })
  assert.deepEqual(parseMigrateArgs(['--from-shell', '--apply'], {}), {
    apply: true,
    fromShell: true,
  })
  assert.deepEqual(parseMigrateArgs(['--apply', '--from-shell'], {}), {
    apply: true,
    fromShell: true,
  })
  assert.deepEqual(parseMigrateArgs(['--from-shell', '--dry-run'], {}), {
    apply: false,
    fromShell: true,
  })
})

test('--apply와 --dry-run을 같이 주면 멈춘다', () => {
  assert.deepEqual(parseMigrateArgs(['--apply', '--dry-run'], {}), { stop: 'APPLY_WITH_DRY_RUN' })
  assert.deepEqual(parseMigrateArgs(['--dry-run', '--from-shell', '--apply'], {}), {
    stop: 'APPLY_WITH_DRY_RUN',
  })
})

test('모르는 인자는 오타든 값이든 멈춘다', () => {
  for (const args of [
    ['--dryrun'],
    ['-n'],
    ['--dry-run=true'],
    ['--apply=true'],
    ['--APPLY'],
    ['apply'],
    ['dev'],
    [''],
    ['--from_shell'],
    ['--apply', 'postgres://u:secret@h/db'],
    ['--apply', '--dryrun'],
  ]) {
    assert.deepEqual(parseMigrateArgs(args, {}), { stop: 'UNKNOWN_ARGUMENT' }, JSON.stringify(args))
  }
})

test('npm이 --dry-run을 삼켰으면(--가 빠졌으면) 멈춘다', () => {
  assert.deepEqual(parseMigrateArgs([], { npm_config_dry_run: 'true' }), {
    stop: 'NPM_SWALLOWED_DRY_RUN',
  })
  assert.deepEqual(parseMigrateArgs(['--apply'], { npm_config_dry_run: 'true' }), {
    stop: 'NPM_SWALLOWED_DRY_RUN',
  })
  // npm은 --dry-run=false를 빈 값으로 넘긴다. 삼킨 것이 아니다.
  assert.deepEqual(parseMigrateArgs([], { npm_config_dry_run: '' }), {
    apply: false,
    fromShell: false,
  })
  assert.deepEqual(parseMigrateArgs([], { npm_config_dry_run: 'false' }), {
    apply: false,
    fromShell: false,
  })
  assert.deepEqual(parseMigrateArgs([], { npm_config_dry_run: undefined }), {
    apply: false,
    fromShell: false,
  })
})

test('주소를 제대로 읽지 못하면 어느 조각도 찍지 않는다', () => {
  for (const url of [
    'postgres://vada:1234/rest@host/db',
    'postgres://vada:12?x=1@host/db',
    'postgres://host/db?x=1@y',
    'postgres://vada:12345/p@ss@host/db',
    // 사용자 이름이 읽혀도 비밀번호의 ?나 #에서 주소가 잘려 @가 쿼리나 해시로 밀린다. 호스트로 읽힌 ss는 비밀번호 조각이다.
    'postgres://u:p@ss?word@host/db',
    'postgres://u:p@ss#word@host/db',
    'postgres://u:pa@ss?x=1&y@z@host/db',
  ]) {
    const shown = describeTarget(url)
    assert.equal(shown, '(주소를 읽지 못했다)', url)
    for (const part of ['vada', '1234', 'rest', 'ss', 'word'])
      assert.ok(!shown.includes(part), `${url} -> ${shown}`)
  }
  // 비밀번호에 @가 있어도 읽히는 주소는 호스트와 DB 이름만 나온다. 쿼리에 @가 없으면 그대로 읽는다.
  assert.equal(describeTarget('postgres://u:pa@ss@host.example/db'), 'host.example/db')
  assert.equal(describeTarget('postgres://host.example:5432/db'), 'host.example/db')
  assert.equal(
    describeTarget('postgres://u:pw@host.example/db?sslmode=require#x'),
    'host.example/db',
  )
})

// 빈 PGlite 위에서 읽기 상태와 점검을 이어 본다. drizzle의 적용 기록 표는 실제 모양(id, hash, created_at)으로 직접 만든다.
const queryOf = (pg: PGlite) => async (text: string) =>
  (await pg.query<Record<string, unknown>>(text)).rows
async function historyTable(pg: PGlite, rows: [hash: string, createdAt: number][]) {
  await pg.exec(
    'CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
  )
  for (const [hash, createdAt] of rows)
    await pg.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
      hash,
      createdAt,
    ])
}

test('읽기 상태 -> 점검: drizzle 스키마가 없는 빈 DB는 적용할 수 있다', async () => {
  const pg = await PGlite.create()
  try {
    const state = await readTargetState(queryOf(pg))
    assert.deepEqual(state, { publicTables: 0, applied: null })
    const real = localMigrations(migrationsFolder)
    assert.deepEqual(checkTarget(state, real), { ok: true, pending: real.length })
  } finally {
    await pg.close()
  }
})

test('읽기 상태 -> 점검: 기록 표만 있고 줄이 없으면 빈 DB일 때만 적용할 수 있다', async () => {
  const pg = await PGlite.create()
  try {
    await historyTable(pg, [])
    const real = localMigrations(migrationsFolder)
    const empty = await readTargetState(queryOf(pg))
    assert.deepEqual(empty, { publicTables: 0, applied: [] })
    assert.deepEqual(checkTarget(empty, real), { ok: true, pending: real.length })
    await pg.exec('CREATE TABLE leftover (id int)')
    const withTable = await readTargetState(queryOf(pg))
    assert.deepEqual(withTable, { publicTables: 1, applied: [] })
    assert.deepEqual(checkTarget(withTable, real), { ok: false, reason: 'NOT_EMPTY' })
  } finally {
    await pg.close()
  }
})

test('읽기 상태 -> 점검: 기록 여러 줄은 시각 순서대로 읽는다(넣은 순서나 내림차순이 아니다)', async () => {
  const pg = await PGlite.create()
  try {
    const three = [
      { hash: 'a', folderMillis: 10 },
      { hash: 'b', folderMillis: 20 },
      { hash: 'c', folderMillis: 30 },
    ]
    // 일부러 뒤섞어 넣는다.
    await historyTable(pg, [
      ['b', 20],
      ['a', 10],
    ])
    await pg.exec('CREATE TABLE somewhere (id int)')
    const state = await readTargetState(queryOf(pg))
    assert.deepEqual(state.applied, [
      { hash: 'a', createdAt: 10 },
      { hash: 'b', createdAt: 20 },
    ])
    assert.deepEqual(checkTarget(state, three), { ok: true, pending: 1 })
  } finally {
    await pg.close()
  }
})

test('읽기 상태 -> 점검: 옛 DB(적용 기록 29줄)는 로컬과 달라서 멈춘다', async () => {
  const pg = await PGlite.create()
  try {
    await historyTable(
      pg,
      Array.from(
        { length: 29 },
        (_, index) => [`old-${index + 1}`, (index + 1) * 1000] as [string, number],
      ),
    )
    await pg.exec('CREATE TABLE old_table (id int)')
    const state = await readTargetState(queryOf(pg))
    assert.equal(state.applied?.length, 29)
    assert.deepEqual(checkTarget(state, localMigrations(migrationsFolder)), {
      ok: false,
      reason: 'HISTORY_MISMATCH',
    })
  } finally {
    await pg.close()
  }
})
