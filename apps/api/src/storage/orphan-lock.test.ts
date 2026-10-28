import assert from 'node:assert/strict'
import { test } from 'node:test'
import type postgres from 'postgres'
import { createObjectPurgeLock } from './orphan-lock.js'

// 같은 DB에 연결하는 전용 세션을 흉내 낸다. 닫힌 소켓은 재사용할 수 없다.
function sessions() {
  let holder: number | undefined
  let nextId = 0
  const calls: { sql: string; args: unknown; session: number }[] = []
  const ended: number[] = []
  const failures = { acquire: false, disconnected: false }
  const open = (options?: postgres.Options<Record<string, never>>) => {
    assert.deepEqual(options, { max: 1, idle_timeout: 0, max_lifetime: 0 })
    const session = ++nextId
    let closed = false
    return {
      unsafe: async (sql: string, args: unknown) => {
        if (closed) throw new Error('닫힌 세션 사용')
        calls.push({ sql, args, session })
        assert.ok(sql.includes('pg_try_advisory_lock'))
        if (failures.disconnected) {
          closed = true
          throw new Error('연결 끊김')
        }
        if (failures.acquire) throw new Error('잠금 실패')
        const locked = holder === undefined
        if (locked) holder = session
        return [{ locked }]
      },
      end: async (options: { timeout: number }) => {
        assert.deepEqual(options, { timeout: 0 })
        closed = true
        if (holder === session) holder = undefined
        ended.push(session)
      },
    } as unknown as Pick<postgres.Sql, 'unsafe' | 'end'>
  }
  return { open, calls, ended, failures }
}

test('두 서버의 겹친 실행은 한 번만 돌고 세션을 닫아 다음 실행을 허용한다', async () => {
  const p = sessions()
  const a = createObjectPurgeLock(p.open)
  const b = createObjectPurgeLock(p.open)
  let enter!: () => void
  let release!: () => void
  const entered = new Promise<void>(resolve => {
    enter = resolve
  })
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  let runs = 0
  const work = async () => {
    runs++
  }
  const first = a(async () => {
    runs++
    enter()
    await gate
  })
  await entered
  assert.equal(await a(work), false)
  assert.equal(await b(work), false)
  assert.equal(runs, 1)
  assert.deepEqual(p.ended, [2])
  release()
  assert.equal(await first, true)
  assert.equal(await b(work), true)
  assert.equal(runs, 2)
  assert.equal(new Set(p.calls.map(call => JSON.stringify(call.args))).size, 1)
  assert.deepEqual(p.ended, [2, 1, 3])
})

test('저장소 처리가 실패해도 전용 세션을 닫아 잠금을 풀고 다음 실행을 허용한다', async () => {
  const p = sessions()
  const lock = createObjectPurgeLock(p.open)
  await assert.rejects(
    lock(async () => {
      throw new Error('목록 실패')
    }),
    /목록 실패/,
  )
  assert.deepEqual(p.ended, [1])
  assert.equal(await lock(async () => {}), true)
  assert.deepEqual(p.ended, [1, 2])
})

test('잠금 질의가 실패해도 세션을 닫고 새 연결로 재시도한다', async () => {
  const p = sessions()
  const lock = createObjectPurgeLock(p.open)
  p.failures.acquire = true
  await assert.rejects(
    lock(async () => assert.fail('실행하면 안 됨')),
    /잠금 실패/,
  )
  assert.deepEqual(p.ended, [1])
  p.failures.acquire = false
  assert.equal(await lock(async () => {}), true)
  assert.deepEqual(p.ended, [1, 2])
})

test('연결이 끊기면 닫힌 세션을 재사용하지 않고 다음 실행에서 새 연결을 연다', async () => {
  const p = sessions()
  const lock = createObjectPurgeLock(p.open)
  p.failures.disconnected = true
  await assert.rejects(
    lock(async () => assert.fail('실행하면 안 됨')),
    /연결 끊김/,
  )
  assert.deepEqual(p.ended, [1])
  p.failures.disconnected = false
  assert.equal(await lock(async () => {}), true)
  assert.deepEqual(p.ended, [1, 2])
})
