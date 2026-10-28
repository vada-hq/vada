import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Actor } from '../access/actor.js'
import { decideDeletion, deletionActionsOf, decideEdit, editActionsOf } from './deletion-policy.js'

const actor: Actor = {
  memberId: 'writer',
  councilId: 'c',
  cohortId: 'k',
  membershipId: 'm',
  councilRank: null,
  departments: [],
}
const own = { senderId: actor.memberId, deletedAt: null, closing: false }

test('삭제 판정과 메뉴: 작성자만 허용하고 시스템 글·남의 글에는 동작이 없다', () => {
  assert.equal(decideDeletion(actor, own), 'delete')
  assert.deepEqual(deletionActionsOf(actor, own), ['message.delete'])
  for (const senderId of [null, 'other']) {
    const facts = { ...own, senderId }
    assert.equal(decideDeletion(actor, facts), 'NOT_FOUND')
    assert.deepEqual(deletionActionsOf(actor, facts), [])
  }
})

test('이미 지운 것은 재요청만 허용하고 그만두는 학생회는 읽기용 동작을 비운다', () => {
  const deleted = { ...own, deletedAt: new Date('2026-10-28T00:00:00Z') }
  assert.equal(decideDeletion(actor, deleted), 'deleted')
  assert.deepEqual(deletionActionsOf(actor, deleted), [])
  for (const facts of [own, deleted]) {
    assert.equal(decideDeletion(actor, { ...facts, closing: true }), 'COUNCIL_CLOSING')
    assert.deepEqual(deletionActionsOf(actor, { ...facts, closing: true }), [])
  }
})

test('고치기와 메뉴는 같은 순서로 작성자·본문·보관·근거 연결을 확인한다', () => {
  const editable = { ...own, body: '글', archived: false, linked: false }
  assert.equal(decideEdit(actor, editable), 'edit')
  assert.deepEqual(editActionsOf(actor, editable), ['message.edit'])
  for (const [facts, expected] of [
    [{ closing: true, senderId: 'other' }, 'COUNCIL_CLOSING'],
    [{ senderId: 'other', linked: true }, 'NOT_FOUND'],
    [{ senderId: null }, 'NOT_FOUND'],
    [{ deletedAt: new Date() }, 'NOT_FOUND'],
    [{ body: '' }, 'MESSAGE_INVALID'],
    [{ archived: true, linked: true }, 'ROOM_ARCHIVED'],
    [{ linked: true }, 'MESSAGE_LINKED'],
  ] as const) {
    assert.equal(decideEdit(actor, { ...editable, ...facts }), expected)
    assert.deepEqual(editActionsOf(actor, { ...editable, ...facts }), [])
  }
})
