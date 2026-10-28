import assert from 'node:assert/strict'
import { test } from 'node:test'
import type postgres from 'postgres'
import { createObjectPurgeLock } from './orphan-lock.js'
import { runObjectPurge } from './orphan-purge.js'
import { fakeStorage } from '../test-support/storage.js'
import { storageKey } from '../test-support/storage-keys.js'

// 같은 DB에 연결하는 전용 세션을 흉내 낸다. 닫힌 소켓은 재사용할 수 없다.
function sessions() {
  let holder: number | undefined
  let nextId = 0
  const calls: { sql: string; args: unknown; session: number }[] = []
  const ended: number[] = []
  const failures = { acquire: false, disconnected: false }
  const disconnects = new Map<number, () => void>()
  const open = (options?: postgres.Options<Record<string, never>>) => {
    const { onclose, ...rest } = options ?? {}
    assert.deepEqual(rest, { max: 1, idle_timeout: 0, max_lifetime: 0 })
    const session = ++nextId
    let closed = false
    disconnects.set(session, () => {
      closed = true
      if (holder === session) holder = undefined
      onclose?.(session)
    })
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
  return { open, calls, ended, failures, disconnect: (id = nextId) => disconnects.get(id)!() }
}

test('잠금 획득 뒤 연결이 끊기면 다른 서버만 삭제를 계속하고 끊긴 세션도 닫는다', async () => {
  for (const stage of ['list', 'references', 'remove']) {
    const p = sessions()
    const a = createObjectPurgeLock(p.open)
    const b = createObjectPurgeLock(p.open)
    const store = fakeStorage()
    const keys = [storageKey('chat', 1), storageKey('chat', 2), storageKey('evidence', 3)]
    for (const key of keys) store.put(key, 1000, 'image/jpeg', new Date('2026-01-01'))
    let otherRan = false
    const disconnect = async () => {
      p.disconnect(1)
      assert.equal(
        await b(async () => {
          otherRan = true
        }),
        true,
      )
    }
    const list = store.storage.list.bind(store.storage)
    const remove = store.storage.remove.bind(store.storage)
    const reads: string[] = []
    store.storage.list = async (prefix, token) => {
      reads.push(prefix)
      if (stage === 'list') await disconnect()
      return list(prefix, token)
    }
    store.storage.remove = async key => {
      await remove(key)
      if (stage === 'remove') await disconnect()
    }
    const db = {
      select: () => ({
        from: () => ({
          where: async () => {
            if (stage === 'references') await disconnect()
            return []
          },
        }),
      }),
    } as never
    const original = console.error
    console.error = () => {}
    try {
      assert.equal(
        await runObjectPurge(db, new Date('2026-10-28'), { storage: store.storage, lock: a }),
        false,
      )
      assert.equal(otherRan, true)
      assert.deepEqual(store.removed, stage === 'remove' ? [keys[0]] : [])
      assert.deepEqual(reads, ['chat/'])
      assert.deepEqual(p.ended, [2, 1])
      assert.equal(await a(async () => {}), true)
    } finally {
      console.error = original
    }
  }
})

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
