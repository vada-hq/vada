import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkTarget, describeTarget, localMigrations, readTargetState, targetSourceOf } from './migrate-check.js'
import { createTestDb, migrationsFolder } from './test-db.js'

const local = [{ hash: 'a', folderMillis: 1 }, { hash: 'b', folderMillis: 2 }]

test('기록이 없는 DB는 비어 있어야 적용한다', () => {
  assert.deepEqual(checkTarget({ publicTables: 0, applied: null }, local), { ok: true, pending: 2 })
  assert.deepEqual(checkTarget({ publicTables: 3, applied: null }, local), { ok: false, reason: 'NOT_EMPTY' })
})

test('기록 표만 있고 줄이 없어도 빈 DB일 때만 적용한다', () => {
  assert.deepEqual(checkTarget({ publicTables: 0, applied: [] }, local), { ok: true, pending: 2 })
  assert.deepEqual(checkTarget({ publicTables: 3, applied: [] }, local), { ok: false, reason: 'NOT_EMPTY' })
})

test('기록이 있으면 로컬과 순서·해시·시각이 같아야 하고, 남은 것만 적용한다', () => {
  assert.deepEqual(checkTarget({ publicTables: 52, applied: [{ hash: 'a', createdAt: 1 }] }, local), { ok: true, pending: 1 })
  assert.deepEqual(checkTarget({ publicTables: 52, applied: [{ hash: 'a', createdAt: 1 }, { hash: 'b', createdAt: 2 }] }, local), { ok: true, pending: 0 })
  for (const applied of [[{ hash: 'x', createdAt: 1 }], [{ hash: 'a', createdAt: 9 }], [{ hash: 'b', createdAt: 2 }],
    [{ hash: 'a', createdAt: 1 }, { hash: 'b', createdAt: 2 }, { hash: 'c', createdAt: 3 }]]) {
    assert.deepEqual(checkTarget({ publicTables: 52, applied }, local), { ok: false, reason: 'HISTORY_MISMATCH' }, JSON.stringify(applied))
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
    const state = await readTargetState(async text => (await pg.query<Record<string, unknown>>(text)).rows)
    assert.equal(state.publicTables, 52)
    assert.deepEqual(checkTarget(state, localMigrations(migrationsFolder)), { ok: true, pending: 0 })
  } finally {
    await close()
  }
})

test('대상 설명에는 호스트와 DB 이름만 나온다', () => {
  assert.equal(describeTarget('postgres://vada:secret-password@ep-cool-1234.ap-southeast-1.aws.neon.tech/vada?sslmode=require'),
    'ep-cool-1234.ap-southeast-1.aws.neon.tech/vada')
  assert.ok(!describeTarget('postgres://vada:secret-password@host/db').includes('secret'))
  assert.equal(describeTarget('not a url'), '(주소를 읽지 못했다)')
})
