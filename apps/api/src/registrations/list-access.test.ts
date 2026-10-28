import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Actor } from '../access/actor.js'
import { ApiError } from '../http/errors.js'
import { createListAccess } from './list-access.js'

const actor: Actor = {
  memberId: 'member',
  membershipId: 'membership',
  councilId: 'council',
  cohortId: 'cohort',
  councilRank: 'president',
  departments: [],
}
const base = { actor, eventId: 'event', session: 'session', now: new Date('2026-10-25T00:00:00Z') }
const invalid = (error: unknown) => error instanceof ApiError && error.code === 'INVALID_INPUT'
test('명단 열람 토큰: 같은 열람은 토큰을 유지하고 새 열람은 새 토큰이다', () => {
  const access = createListAccess()
  const first = access(base)
  assert.equal(first.first, true)
  assert.deepEqual(access({ ...base, token: first.token }), { token: first.token, first: false })
  assert.notEqual(access(base).token, first.token)
})
test('명단 열람 토큰: 위조·깨진 서명·다른 사람/소속/학생회/행사/세션·만료·서버 교체는 400이다', () => {
  const access = createListAccess()
  const { token } = access(base)
  for (const value of ['x', token + '.x', token.slice(0, -1) + '가', token + 'x'])
    assert.throws(() => access({ ...base, token: value }), invalid)
  for (const change of [
    { actor: { ...actor, memberId: 'other' } },
    { actor: { ...actor, membershipId: 'other' } },
    { actor: { ...actor, councilId: 'other' } },
    { eventId: 'other' },
    { session: 'other' },
    { now: new Date('2026-10-25T01:00:00Z') },
  ])
    assert.throws(() => access({ ...base, ...change, token }), invalid)
  assert.throws(() => createListAccess()({ ...base, token }), invalid)
})
