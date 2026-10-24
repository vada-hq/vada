import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actorOf } from '../access/actor.js'
import { runPurchases, type PurchaseKit } from '../test-support/purchases.js'
import {
  actionsOf,
  decide,
  lineItemStatusOf,
  requestStatusOf,
  type RequestFacts,
} from './policy.js'

const facts = (over: Partial<RequestFacts> = {}): RequestFacts => ({
  requestedBy: 'someone',
  status: 'pending',
  requestCancelled: false,
  decided: false,
  eventCompleted: false,
  ...over,
})

test('요청 상태: 마지막 결과를 센다(취소 품목 포함)', () => {
  const of = (cancelled: boolean, c: Partial<Parameters<typeof requestStatusOf>[1]>) =>
    requestStatusOf(cancelled, { items: 2, pending: 0, approved: 0, cancelled: 0, ...c })
  assert.equal(of(false, { pending: 1 }), 'pending')
  assert.equal(of(false, { pending: 1, cancelled: 1 }), 'pending')
  assert.equal(of(false, { cancelled: 2 }), 'cancelled')
  assert.equal(of(false, { approved: 1, cancelled: 1 }), 'partial')
  assert.equal(of(false, { approved: 0, cancelled: 1 }), 'rejected')
  assert.equal(of(false, { approved: 0 }), 'rejected')
  assert.equal(of(false, { approved: 1 }), 'partial')
  assert.equal(of(false, { approved: 2 }), 'approved')
  assert.equal(of(true, { approved: 2 }), 'cancelled')
})

test('품목 상태는 마지막 결과다', () => {
  assert.deepEqual([null, 'approved', 'rejected', 'cancelled', 'audited'].map(lineItemStatusOf), [
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'pending',
  ])
})

const actorFor = async (s: PurchaseKit, user: string) =>
  (await actorOf(s.db, s.council.people[user as 'plain'].userId, s.council.councilId, new Date()))!

test(
  'decide: 403 → 완료한 행사 → 요청 상태 순서이고 읽기 동작과 같다',
  runPurchases(async s => {
    const finance = await actorFor(s, 'financeMember')
    const plain = await actorFor(s, 'plain')
    assert.equal(decide(finance, facts(), 'purchase.approve'), null)
    assert.equal(decide(plain, facts(), 'purchase.approve'), 'FORBIDDEN')
    assert.equal(
      decide(finance, facts({ eventCompleted: true }), 'purchase.approve'),
      'EVENT_COMPLETED',
    )
    assert.equal(
      decide(finance, facts({ requestCancelled: true, status: 'cancelled' }), 'purchase.approve'),
      'REQUEST_CLOSED',
    )
    // 품목이 모두 취소돼 상태가 취소여도 요청 자체는 열려 있다: 결재하려 하면 이미 결재된 품목이다.
    assert.equal(
      decide(finance, facts({ status: 'cancelled', decided: true }), 'purchase.approve'),
      'LINE_ITEM_DECIDED',
    )
    assert.equal(
      decide(finance, facts({ status: 'partial' }), 'purchase.approve'),
      'LINE_ITEM_DECIDED',
    )
    // 요청 취소는 요청한 사람만, 결재가 시작되면 닫힌다.
    assert.equal(decide(finance, facts(), 'purchase.cancel'), 'FORBIDDEN')
    const mine = facts({ requestedBy: finance.memberId })
    assert.equal(decide(finance, mine, 'purchase.cancel'), null)
    assert.equal(decide(finance, { ...mine, decided: true }, 'purchase.cancel'), 'REQUEST_CLOSED')
    assert.deepEqual(actionsOf(finance, mine), ['purchase.cancel', 'purchase.approve'])
    assert.deepEqual(actionsOf(finance, { ...mine, eventCompleted: true }), [])
  }),
)
