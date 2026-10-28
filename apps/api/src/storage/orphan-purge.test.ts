import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { setErrorReporter } from '../http/on-error.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { fakeStorage } from '../test-support/storage.js'
import { runObjectPurge } from './orphan-purge.js'

const now = new Date('2026-10-28T03:00:00Z')
const cutoff = now.getTime() - 72 * 3_600_000
const unlocked = async (work: () => Promise<void>) => {
  await work()
  return true
}
const emptyReferences = {
  select: () => ({ from: () => ({ where: async () => [] }) }),
} as never

test('72시간을 넘긴 chat·evidence 중 어느 학생회의 파일 행도 가리키지 않는 객체만 지운다', async () => {
  const t = await createTestDb()
  const store = fakeStorage()
  try {
    const councils = [await seedCouncil(t.db, t.pg), await seedCouncil(t.db, t.pg, 'o')]
    for (const council of councils) {
      for (const area of ['chat', 'evidence']) {
        const key = `${area}/${council.councilId}/attached`
        store.put(key, 1000, 'image/jpeg', new Date(cutoff - 1))
        await t.db.transaction(tx =>
          createRecord(tx, {
            kind: 'file',
            councilId: council.councilId,
            actor: council.people.president.memberId,
            values: {
              name: '사진.jpg',
              mediaType: 'image/jpeg',
              sizeBytes: 1000,
              storageKey: key,
              attachedToId: null,
            },
          }),
        )
      }
    }
    for (const area of ['chat', 'evidence', 'receipts', 'chatty']) {
      for (const delta of [-1, 0, 1])
        store.put(`${area}/${delta}`, 1000, 'image/jpeg', new Date(cutoff + delta))
    }
    await runObjectPurge(t.db, now, { storage: store.storage, lock: unlocked })
    assert.deepEqual(store.removed.sort(), ['chat/-1', 'evidence/-1'])
    assert.equal(await runObjectPurge(t.db, now, { storage: store.storage, lock: unlocked }), true)
    assert.equal(store.removed.length, 2)
  } finally {
    await t.close()
  }
})

test('목록·지우기 실패는 키·본문·이름 없이 개수로 보고하고 다음 실행에서 다시 지운다', async () => {
  const t = await createTestDb()
  const store = fakeStorage()
  const logs: string[] = []
  const reports: unknown[] = []
  const original = console.error
  console.error = (line: string) => logs.push(line)
  setErrorReporter((error, fields) => reports.push({ error: error.message, fields }))
  try {
    store.put('chat/secret-key', 1000, 'image/jpeg', new Date(cutoff - 1))
    store.put('evidence/secret-key', 1000, 'image/jpeg', new Date(cutoff - 1))
    const list = store.storage.list.bind(store.storage)
    const remove = store.storage.remove.bind(store.storage)
    store.storage.list = () => Promise.reject(new Error('secret-key body name'))
    await runObjectPurge(t.db, now, { storage: store.storage, lock: unlocked })
    assert.equal(store.removed.length, 0)
    store.storage.list = list
    store.storage.remove = () => Promise.reject(new Error('secret-key body name'))
    await runObjectPurge(t.db, now, { storage: store.storage, lock: unlocked })
    assert.equal(store.removed.length, 0)
    store.storage.remove = remove
    await runObjectPurge(t.db, now, { storage: store.storage, lock: unlocked })
    assert.equal(store.removed.length, 2)
    assert.equal(logs.length, 2)
    assert.ok(!JSON.stringify({ logs, reports }).includes('secret-key'))
    assert.equal((JSON.parse(logs[0]!) as { failed: number }).failed, 2)
    assert.equal((JSON.parse(logs[1]!) as { failed: number }).failed, 2)
  } finally {
    console.error = original
    setErrorReporter(undefined)
    await t.close()
  }
})

test('원본 파일의 저장소 위치를 비워도 증빙으로 복사한 객체와 파일은 남는다', async () => {
  const t = await createTestDb()
  const store = fakeStorage(() => new Date(cutoff - 1))
  try {
    const council = await seedCouncil(t.db, t.pg)
    const originalKey = `chat/${council.councilId}/original`
    const copyKey = `evidence/${council.councilId}/copy`
    store.put(originalKey)
    await store.storage.copy(originalKey, copyKey)
    const ids: string[] = []
    for (const key of [originalKey, copyKey]) {
      const made = await t.db.transaction(tx =>
        createRecord(tx, {
          kind: 'file',
          councilId: council.councilId,
          actor: council.people.president.memberId,
          values: {
            name: '사진.jpg',
            mediaType: 'image/jpeg',
            sizeBytes: 1000,
            storageKey: key,
            attachedToId: null,
          },
        }),
      )
      ids.push(made)
    }
    await t.pg.query('UPDATE file SET name = NULL, storage_key = NULL WHERE id = $1', [ids[0]])
    await runObjectPurge(t.db, now, { storage: store.storage, lock: unlocked })
    assert.deepEqual(store.removed, [originalKey])
    assert.ok(await store.storage.head(copyKey))
    assert.deepEqual(
      (
        await t.pg.query<{ storage_key: string }>('SELECT storage_key FROM file WHERE id = $1', [
          ids[1],
        ])
      ).rows,
      [{ storage_key: copyKey }],
    )
  } finally {
    await t.close()
  }
})

test('저장소가 없거나 잠금을 다른 서버가 쥐면 DB와 저장소를 읽지 않는다', async () => {
  const store = fakeStorage()
  const untouched = {
    select: () => {
      throw new Error('DB를 읽으면 안 됨')
    },
  } as never
  assert.equal(await runObjectPurge(untouched, now), false)
  store.storage.list = () => {
    throw new Error('목록을 읽으면 안 됨')
  }
  assert.equal(
    await runObjectPurge(untouched, now, { storage: store.storage, lock: async () => false }),
    false,
  )
})

test('목록의 모든 쪽과 두 접두어를 끝까지 지운다', async () => {
  const store = fakeStorage()
  for (let n = 0; n < 1002; n++)
    store.put(`chat/${String(n).padStart(4, '0')}`, 1000, 'image/jpeg', new Date(cutoff - 1))
  store.put('evidence/orphan', 1000, 'image/jpeg', new Date(cutoff - 1))
  const pages: (string | undefined)[] = []
  const list = store.storage.list.bind(store.storage)
  store.storage.list = (prefix, token) => {
    pages.push(token)
    return list(prefix, token)
  }
  await runObjectPurge(emptyReferences, now, { storage: store.storage, lock: unlocked })
  assert.equal(store.removed.length, 1003)
  await runObjectPurge(emptyReferences, now, { storage: store.storage, lock: unlocked })
  assert.equal(store.removed.length, 1003)
  assert.ok(pages.some(Boolean))
})

test('앞 접두어의 지우기가 계속 실패해도 뒤 접두어의 객체를 지운다', async () => {
  const store = fakeStorage()
  const original = console.error
  console.error = () => {}
  try {
    for (let n = 0; n < 1001; n++) store.put(`chat/${n}`, 1000, 'image/jpeg', new Date(cutoff - 1))
    store.put('evidence/orphan', 1000, 'image/jpeg', new Date(cutoff - 1))
    const remove = store.storage.remove.bind(store.storage)
    store.storage.remove = key =>
      key.startsWith('chat/') ? Promise.reject(new Error('삭제 실패')) : remove(key)
    await runObjectPurge(emptyReferences, now, { storage: store.storage, lock: unlocked })
    assert.deepEqual(store.removed, ['evidence/orphan'])
  } finally {
    console.error = original
  }
})

test('파일 참조 조회가 실패하면 해당 쪽의 객체를 지우지 않고 다음 실행에 다시 확인한다', async () => {
  const store = fakeStorage()
  const original = console.error
  console.error = () => {}
  try {
    store.put('chat/orphan', 1000, 'image/jpeg', new Date(cutoff - 1))
    const failed = {
      select: () => {
        throw new Error('조회 실패')
      },
    } as never
    await runObjectPurge(failed, now, { storage: store.storage, lock: unlocked })
    assert.deepEqual(store.removed, [])
    await runObjectPurge(emptyReferences, now, { storage: store.storage, lock: unlocked })
    assert.deepEqual(store.removed, ['chat/orphan'])
  } finally {
    console.error = original
  }
})
