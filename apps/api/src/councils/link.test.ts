import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { addUser } from '../test-support/council.js'
import { linkMember } from './link.js'

test('처음 잇으면 운영진을 만든다: 이름은 로그인 이름, 이메일은 소문자. 다시 부르면 같은 운영진이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await addUser(pg, 'u1', { name: '김회장', email: 'Kim.Hoe@Example.COM' })
    const first = await db.transaction(tx => linkMember(tx, 'u1'))
    assert.equal(await db.transaction(tx => linkMember(tx, 'u1')), first)
    assert.deepEqual((await pg.query('SELECT name, email FROM member')).rows, [
      { name: '김회장', email: 'kim.hoe@example.com' },
    ])
    assert.deepEqual((await pg.query('SELECT member_id, user_id FROM member_login')).rows, [
      { member_id: first, user_id: 'u1' },
    ])
    // 로그인 잇기가 만든 운영진은 시스템이 만든 기록이다(만든 사람과 판 1의 바꾼 사람이 없다).
    assert.deepEqual(
      (await pg.query('SELECT created_by, council_id FROM record WHERE id = $1', [first])).rows,
      [{ created_by: null, council_id: null }],
    )
    assert.deepEqual(
      (
        await pg.query('SELECT version_no, changed_by FROM record_version WHERE record_id = $1', [
          first,
        ])
      ).rows,
      [{ version_no: 1, changed_by: null }],
    )
  } finally {
    await close()
  }
})

test('같은 이메일의 잇지 않은 운영진이 있으면 그 운영진에 잇는다. 대문자 이메일도 같은 사람이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const waiting = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'member',
        councilId: null,
        actor: null,
        values: { name: '미리 적은 이름', email: 'lee@example.test' },
      }),
    )
    await addUser(pg, 'u2', { name: '이부원', email: 'LEE@Example.test' })
    assert.equal(await db.transaction(tx => linkMember(tx, 'u2')), waiting)
    assert.equal((await pg.query('SELECT id FROM member')).rows.length, 1)
  } finally {
    await close()
  }
})

test('다른 계정에 이어진 운영진이 같은 이메일을 쓰면 409 EMAIL_IN_USE이고 아무것도 만들지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await addUser(pg, 'old', { name: '예전 계정', email: 'park@example.test' })
    await db.transaction(tx => linkMember(tx, 'old'))
    // 같은 이메일이 다른 Google 계정으로 옮겨 간 경우(드물다)
    await pg.query("UPDATE users SET email = 'park-old@example.test' WHERE id = 'old'")
    await addUser(pg, 'new', { name: '새 계정', email: 'park@example.test' })
    await assert.rejects(
      db.transaction(tx => linkMember(tx, 'new')),
      { code: 'EMAIL_IN_USE', status: 409 },
    )
    assert.equal((await pg.query('SELECT member_id FROM member_login')).rows.length, 1)
    assert.equal((await pg.query('SELECT id FROM member')).rows.length, 1)
  } finally {
    await close()
  }
})

test('이메일을 확인하지 않은 로그인은 같은 이메일의 운영진을 가로채지 못한다: 409 EMAIL_IN_USE이고 그 운영진은 잇지 않은 채로 남는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const waiting = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'member',
        councilId: null,
        actor: null,
        values: { name: '미리 적은 이름', email: 'lee@example.test' },
      }),
    )
    await addUser(pg, 'unverified', {
      name: '확인 안 된 사람',
      email: 'lee@example.test',
      emailVerified: false,
    })
    await assert.rejects(
      db.transaction(tx => linkMember(tx, 'unverified')),
      { code: 'EMAIL_IN_USE', status: 409 },
    )
    assert.equal((await pg.query('SELECT 1 FROM member_login')).rows.length, 0)
    assert.deepEqual((await pg.query('SELECT id FROM member')).rows, [{ id: waiting }])
    // 확인된 같은 이메일의 로그인이 오면 그 운영진에 잇는다.
    await pg.query("UPDATE users SET email = 'unverified@example.test' WHERE id = 'unverified'")
    await addUser(pg, 'verified', {
      name: '확인된 사람',
      email: 'lee@example.test',
      emailVerified: true,
    })
    assert.equal(await db.transaction(tx => linkMember(tx, 'verified')), waiting)
  } finally {
    await close()
  }
})

test('이메일을 확인하지 않은 로그인도 같은 이메일의 운영진이 없으면 새 운영진이 된다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await addUser(pg, 'fresh', {
      name: '새 사람',
      email: 'fresh@example.test',
      emailVerified: false,
    })
    const memberId = await db.transaction(tx => linkMember(tx, 'fresh'))
    assert.deepEqual((await pg.query('SELECT id, name, email FROM member')).rows, [
      { id: memberId, name: '새 사람', email: 'fresh@example.test' },
    ])
  } finally {
    await close()
  }
})
