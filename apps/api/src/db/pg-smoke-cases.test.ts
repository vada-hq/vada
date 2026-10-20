import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../http/errors.js'
import { addUser } from '../test-support/council.js'
import { pgliteConnection } from '../test-support/smoke-connection.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  createAndJoinCase,
  joinTwiceCase,
  rotateTogetherCase,
  sessionDuringJoinCase,
  transferAndRemoveCase,
  unexpectedFailures,
  writePathCase,
  type SmokeContext,
  type SmokeVerdict,
} from './pg-smoke-cases.js'
import { createTestDb, type TestDb } from './test-db.js'

// PGlite는 연결이 하나이고 거래를 하나씩 돌린다. 그래서 아래 시험은 "동시에" 시작한 두 거래를 순서대로 돌려 각 경우의 모양
// (준비, 판정, 예상한 오류 거르기)을 확인할 뿐, 잠금이 실제로 동시 처리를 막는지는 증명하지 못한다. 그것은 실제 PostgreSQL에서 pg-smoke가 보인다.
const now = new Date('2026-10-19T03:00:00Z')

function contextOf(
  testDb: TestDb,
  connect: () => SmokeConnection = () => pgliteConnection(testDb),
): SmokeContext {
  return { connect, now, sessionLimitMs: 2000 }
}
const passed = (verdict: SmokeVerdict) => {
  assert.equal(verdict.ok, true, JSON.stringify(verdict))
  return verdict.detail
}

// 첫 연결(준비와 확인)을 뺀, 동시에 움직이는 쪽 연결은 거래를 열면 DB 오류로 실패한다.
function failingParticipants(testDb: TestDb, code: string): () => SmokeConnection {
  let opened = 0
  return () => {
    const base = pgliteConnection(testDb)
    if (opened++ === 0) return base
    const error = Object.assign(new Error('postgres://u:secret@h/db'), { code })
    return {
      ...base,
      db: new Proxy(base.db, {
        get(target, property) {
          if (property === 'transaction') return () => Promise.reject(error)
          const value: unknown = Reflect.get(target, property, target)
          return typeof value === 'function'
            ? (value as (...args: unknown[]) => unknown).bind(target)
            : value
        },
      }),
    }
  }
}

test('예상한 ApiError 코드만 거르고, 그 밖의 실패는 코드와 함께 돌려준다', () => {
  const rejected = (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason })
  const results: PromiseSettledResult<unknown>[] = [
    { status: 'fulfilled', value: 1 },
    rejected(new ApiError('PRESIDENT_CANNOT_LEAVE', 409)),
    rejected(new ApiError('NOT_FOUND', 404)),
    rejected(Object.assign(new Error('duplicate key'), { code: '23505' })),
    rejected(new Error('postgres://u:secret@h/db')),
    rejected('문자열'),
  ]
  assert.deepEqual(unexpectedFailures(results, new Set(['PRESIDENT_CANNOT_LEAVE'])), [
    'NOT_FOUND',
    '23505',
    'ERROR',
    'ERROR',
  ])
  assert.deepEqual(unexpectedFailures(results.slice(0, 2), new Set(['PRESIDENT_CANNOT_LEAVE'])), [])
})

test('쓰기 길: 학생회, 부서, 이름 바꾸기, 부서 배정, 학생회 정보를 쓰면 판 수와 마지막 판의 값이 기대와 같다', async () => {
  const testDb = await createTestDb()
  try {
    const detail = passed(await writePathCase.run(contextOf(testDb)))
    assert.match(detail, /학생회 2.*부서 2.*부서 소속 1/)
    // 판은 기록마다 이어진 번호이고 열린 판은 하나뿐이다.
    const rows = (
      await testDb.pg.query<{ n: number; open: number }>(
        `SELECT count(*)::int AS n, count(*) FILTER (WHERE upper_inf(valid))::int AS open
         FROM record_version GROUP BY record_id ORDER BY n DESC`,
      )
    ).rows
    assert.ok(rows.every(row => row.open === 1))
    assert.equal(rows[0]!.n, 2)
  } finally {
    await testDb.close()
  }
})

test('쓰기 길: 판이 빠지면 실패로 판정한다', async () => {
  const testDb = await createTestDb()
  try {
    const verdict = await writePathCase.run(
      contextOf(testDb, () => {
        const base = pgliteConnection(testDb)
        return {
          ...base,
          sql: {
            unsafe: async (text, params) => {
              const rows = await base.sql.unsafe(text, params)
              return text.includes('record_version') ? rows.slice(0, 1) : rows
            },
          },
        }
      }),
    )
    assert.ok(!verdict.ok && verdict.code === 'MISMATCH' && /판/.test(verdict.detail))
  } finally {
    await testDb.close()
  }
})

test('같은 계정이 같은 코드로 동시에 두 번 들어오기: 열린 학생회 소속 1개 (PGlite는 순서대로 돌려 모양만 본다)', async () => {
  const testDb = await createTestDb()
  try {
    assert.match(passed(await joinTwiceCase.run(contextOf(testDb))), /열린 학생회 소속 1개/)
    const rows = await testDb.pg.query(
      `SELECT 1 FROM council_membership cm JOIN member_login ml ON ml.member_id = cm.member_id
       WHERE ml.user_id = 'smoke-a-guest'`,
    )
    assert.equal(rows.rows.length, 1)
  } finally {
    await testDb.close()
  }
})

test('같은 계정이 같은 코드로 동시에 두 번 들어오기: 한쪽이 DB 오류로 실패하면 그 코드로 실패한다', async () => {
  const testDb = await createTestDb()
  try {
    const verdict = await joinTwiceCase.run(contextOf(testDb, failingParticipants(testDb, '23505')))
    assert.ok(!verdict.ok && verdict.code === '23505', JSON.stringify(verdict))
    assert.ok(!JSON.stringify(verdict).includes('secret'))
  } finally {
    await testDb.close()
  }
})

test('회장단 둘이 동시에 초대 코드 바꾸기: 둘 다 끝나고 쓸 수 있는 코드 1개 (PGlite는 순서대로 돌려 모양만 본다)', async () => {
  const testDb = await createTestDb()
  try {
    assert.match(passed(await rotateTogetherCase.run(contextOf(testDb))), /코드 1개/)
    assert.equal((await testDb.pg.query('SELECT code FROM invite_code')).rows.length, 1)
  } finally {
    await testDb.close()
  }
})

test('회장단 둘이 동시에 초대 코드 바꾸기: 예상하지 못한 DB 오류는 코드와 함께 실패다', async () => {
  const testDb = await createTestDb()
  try {
    const verdict = await rotateTogetherCase.run(
      contextOf(testDb, failingParticipants(testDb, '40001')),
    )
    assert.ok(!verdict.ok && verdict.code === '40001', JSON.stringify(verdict))
  } finally {
    await testDb.close()
  }
})

test('회장 넘기기와 그 사람 내보내기를 동시에: 회장은 1명이고 한쪽만 예상한 오류로 끝난다 (PGlite는 순서대로 돌려 모양만 본다)', async () => {
  const testDb = await createTestDb()
  try {
    const detail = passed(await transferAndRemoveCase.run(contextOf(testDb)))
    assert.match(detail, /회장 1명/)
    assert.match(detail, /PRESIDENT_CANNOT_LEAVE|NOT_FOUND/)
  } finally {
    await testDb.close()
  }
})

test('회장 넘기기와 그 사람 내보내기를 동시에: 예상하지 못한 DB 오류는 코드와 함께 실패다', async () => {
  const testDb = await createTestDb()
  try {
    const verdict = await transferAndRemoveCase.run(
      contextOf(testDb, failingParticipants(testDb, '40P01')),
    )
    assert.ok(!verdict.ok && verdict.code === '40P01', JSON.stringify(verdict))
  } finally {
    await testDb.close()
  }
})

test('새 계정이 학생회 만들기와 들어오기를 동시에: 학생회마다 소속 1개, 로그인 연결 1개 (PGlite는 순서대로 돌려 모양만 본다)', async () => {
  const testDb = await createTestDb()
  try {
    assert.match(passed(await createAndJoinCase.run(contextOf(testDb))), /학생회마다 소속 1개/)
  } finally {
    await testDb.close()
  }
})

test('새 계정이 학생회 만들기와 들어오기를 동시에: 예상하지 못한 DB 오류는 코드와 함께 실패다', async () => {
  const testDb = await createTestDb()
  try {
    const verdict = await createAndJoinCase.run(
      contextOf(testDb, failingParticipants(testDb, '23505')),
    )
    assert.ok(!verdict.ok && verdict.code === '23505', JSON.stringify(verdict))
  } finally {
    await testDb.close()
  }
})

test('다른 연결이 세션을 넣는 일: 막히지 않으면 통과다 (별도 DB를 다른 연결 삼아 모양만 본다. 실제 잠금은 PGlite로 증명하지 못한다)', async () => {
  const locker = await createTestDb()
  const prober = await createTestDb()
  try {
    // 잠금을 잡는 연결과 세션을 넣는 연결이 서로 다른 DB를 가리키므로 PGlite의 거래 대기에 걸리지 않는다.
    await addUser(prober.pg, 'smoke-e-guest')
    const connections = [locker, locker, prober]
    let opened = 0
    const verdict = await sessionDuringJoinCase.run(
      contextOf(locker, () => pgliteConnection(connections[Math.min(opened++, 2)]!)),
    )
    assert.match(passed(verdict), /세션/)
    assert.equal(
      (await prober.pg.query("SELECT 1 FROM sessions WHERE user_id = 'smoke-e-guest'")).rows.length,
      1,
    )
  } finally {
    await locker.close()
    await prober.close()
  }
})

test('다른 연결이 세션을 넣는 일: 한도 안에 끝나지 않으면 실패로 판정하고, 잠금을 놓아 둘 다 끝낸다', async () => {
  const testDb = await createTestDb()
  try {
    // 같은 PGlite에서는 거래가 열려 있는 동안 다른 쿼리가 기다린다. 잠금이 쓰기를 막는 것과 같은 모습이다.
    const verdict = await sessionDuringJoinCase.run({ ...contextOf(testDb), sessionLimitMs: 50 })
    assert.ok(!verdict.ok && verdict.code === 'SESSION_BLOCKED', JSON.stringify(verdict))
    // 놓은 뒤 거래는 커밋되고 막혔던 쓰기도 끝났다.
    assert.equal(
      (await testDb.pg.query("SELECT 1 FROM sessions WHERE user_id = 'smoke-e-guest'")).rows.length,
      1,
    )
    assert.equal(
      (
        await testDb.pg.query(
          `SELECT 1 FROM council_membership cm JOIN member_login ml ON ml.member_id = cm.member_id
           WHERE ml.user_id = 'smoke-e-guest'`,
        )
      ).rows.length,
      1,
    )
  } finally {
    await testDb.close()
  }
})
