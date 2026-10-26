import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Actor } from '../access/actor.js'
import { shipmentChangeCode } from './policy.js'

const actor: Actor = {
  councilId: 'c',
  memberId: 'me',
  cohortId: 'k',
  membershipId: 'm',
  councilRank: null,
  departments: [],
}
const open = { requestedBy: 'me', requestCancelled: false, eventCompleted: false }

test('송장 변경 정책은 요청자·재정만 허용하고 행사 완료와 요청 취소를 막는다', () => {
  assert.equal(shipmentChangeCode(actor, open), null)
  assert.equal(shipmentChangeCode(actor, { ...open, requestedBy: 'other' }), 'FORBIDDEN')
  assert.equal(
    shipmentChangeCode({ ...actor, councilRank: 'president' }, { ...open, requestedBy: 'other' }),
    'FORBIDDEN',
  )
  const finance: Actor = {
    ...actor,
    departments: [{ departmentId: 'd', role: 'finance', rank: null }],
  }
  assert.equal(shipmentChangeCode(finance, { ...open, requestedBy: 'other' }), null)
  assert.equal(shipmentChangeCode(actor, { ...open, eventCompleted: true }), 'EVENT_COMPLETED')
  assert.equal(shipmentChangeCode(actor, { ...open, requestCancelled: true }), 'REQUEST_CLOSED')
})
