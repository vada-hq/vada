import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withSettlement } from '../test-support/settlement.js'

test(
  '구독은 운영진·학생회당 하나, 해시는 소문자 SHA-256만 허용하고 중복·없는 부모를 막는다',
  withSettlement(async t => {
    const member = t.council.people.planningMember.memberId
    const council = t.council.councilId
    const insert = (hash: string, memberId = member, councilId = council) =>
      t.pg.query(
        'INSERT INTO calendar_feed (member_id, council_id, token_hash) VALUES ($1, $2, $3)',
        [memberId, councilId, hash],
      )
    for (const hash of ['', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64)])
      await assert.rejects(insert(hash))
    await insert('a'.repeat(64))
    await assert.rejects(insert('b'.repeat(64)))
    await assert.rejects(insert('a'.repeat(64), t.council.people.financeMember.memberId))
    await assert.rejects(insert('c'.repeat(64), '00000000-0000-4000-8000-000000000000'))
    await assert.rejects(insert('c'.repeat(64), member, '00000000-0000-4000-8000-000000000000'))
    await insert('b'.repeat(64), member, t.other.councilId)
  }),
)
