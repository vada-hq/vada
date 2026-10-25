import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { ApiError } from '../http/errors.js'
import { markLeft, seedCouncil } from '../test-support/council.js'
import { renameMe } from './service.js'

// 탈퇴와 겹친 내 이름 고치기. 운영진 행을 기다린 사이 탈퇴가 이름을 비우고 탈퇴한 시각을 넣었으면, 잠근 행은 탈퇴한 운영진이다.
// 그 행에 이름을 쓰면 운영진 CHECK(0016)에 걸려 500이 되므로, 계정이 없어진 것으로 보고 401이다. 이름은 비운 채 그대로다.
test('탈퇴한 운영진의 이름 고치기는 401 UNAUTHENTICATED이고 이름이 다시 들어가지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { people } = await seedCouncil(db, pg, 's')
    await markLeft(pg, people.plain.memberId, '2026-10-25T03:00:00Z')
    await assert.rejects(
      db.transaction(tx => renameMe(tx, people.plain.userId, '새 이름')),
      (error: unknown) => error instanceof ApiError && error.code === 'UNAUTHENTICATED',
    )
    const { rows } = await pg.query('SELECT name FROM member WHERE id = $1', [
      people.plain.memberId,
    ])
    assert.deepEqual(rows, [{ name: null }])
  } finally {
    await close()
  }
})
