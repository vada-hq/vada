import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Actor } from '../access/actor.js'
import { fakeStorage } from '../test-support/storage.js'
import { newStorageKey, verifyUploads } from './uploads.js'

const actor: Actor = {
  councilId: 'council',
  memberId: 'member',
  cohortId: 'cohort',
  membershipId: 'membership',
  councilRank: null,
  departments: [],
}
const expiry = new Date('2026-10-28T03:00:00Z')

for (const area of ['chat', 'evidence']) {
  test(`${area}: 만료 전 검사를 마친 요청이 붙인 객체를 만료 후 요청이 지우지 않는다`, async () => {
    const store = fakeStorage()
    const key = newStorageKey(area, actor)
    store.put(key, 1000, 'image/jpeg', new Date(expiry.getTime() - 86_400_000))
    let attached = false
    const db = {
      select: () => ({ from: () => ({ where: async () => (attached ? [{ id: key }] : []) }) }),
    } as never
    const accepted = await verifyUploads(
      db,
      store.storage,
      { area, actor, now: new Date(expiry.getTime() - 1) },
      [key],
    )
    assert.equal(accepted[0]?.key, key)

    let entered!: () => void
    let release!: () => void
    const atHead = new Promise<void>(resolve => {
      entered = resolve
    })
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const head = store.storage.head.bind(store.storage)
    store.storage.head = async asked => {
      entered()
      await gate
      return head(asked)
    }
    const expired = verifyUploads(
      db,
      store.storage,
      { area, actor, now: new Date(expiry.getTime() + 1) },
      [key],
    )
    await atHead
    // 만료 요청의 참조 조회 뒤에 앞 요청이 파일 행을 저장하는 순서다.
    attached = true
    release()
    await assert.rejects(expired, { code: 'UPLOAD_MISMATCH' })
    assert.deepEqual(store.removed, [])
    assert.ok(await head(key))
  })
}
