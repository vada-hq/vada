import assert from 'node:assert/strict'
import { test } from 'node:test'
import { purgeOnOf } from './purge-date.js'
import { registrationStatusOf, remainingOf } from './state.js'

const korean = (value: string) => new Date(`${value}+09:00`)
const base: Parameters<typeof registrationStatusOf>[0] = {
  opensAt: korean('2026-11-01T09:00:00'),
  closesAt: korean('2026-11-08T18:00:00'),
  paused: false,
  capacity: 3,
  applicantCount: 0,
  eventCompleted: false,
}
const at = (value: string, change: Partial<typeof base> = {}) =>
  registrationStatusOf({ ...base, ...change }, korean(value))

test('상태는 마감, 멈춤, 시작 전, 정원 참, 받는 중의 차례로 맞는 것이다', () => {
  assert.equal(at('2026-11-02T10:00:00'), 'open')
  assert.equal(at('2026-11-02T10:00:00', { applicantCount: 3 }), 'full')
  assert.equal(at('2026-10-31T10:00:00', { applicantCount: 3 }), 'before_open')
  assert.equal(at('2026-10-31T10:00:00', { paused: true }), 'paused')
  assert.equal(at('2026-11-02T10:00:00', { paused: true, applicantCount: 3 }), 'paused')
  assert.equal(at('2026-11-09T10:00:00', { paused: true, applicantCount: 3 }), 'closed')
})

test('완료한 행사의 양식은 다른 상태와 상관없이 마감이다', () => {
  assert.equal(at('2026-11-02T10:00:00', { eventCompleted: true }), 'closed')
  assert.equal(at('2026-10-31T10:00:00', { eventCompleted: true, paused: true }), 'closed')
})

test('시작과 마감 경계는 ±1초로 갈린다: 시작 시각부터 받고 마감 시각부터 닫힌다', () => {
  assert.equal(at('2026-11-01T08:59:59'), 'before_open')
  assert.equal(at('2026-11-01T09:00:00'), 'open')
  assert.equal(at('2026-11-08T17:59:59'), 'open')
  assert.equal(at('2026-11-08T18:00:00'), 'closed')
  assert.equal(at('2026-11-08T18:00:01'), 'closed')
})

test('시작이 없으면 처음부터 받고, 정원이 없으면 차지 않는다', () => {
  assert.equal(at('2000-01-01T00:00:00', { opensAt: null }), 'open')
  assert.equal(at('2026-11-02T10:00:00', { capacity: null, applicantCount: 5000 }), 'open')
})

test('정원을 지금 수보다 줄여도 되고 남은 자리는 0 밑으로 내려가지 않는다', () => {
  assert.equal(at('2026-11-02T10:00:00', { capacity: 2, applicantCount: 3 }), 'full')
  assert.equal(remainingOf(2, 3), 0)
  assert.equal(remainingOf(3, 2), 1)
  assert.equal(remainingOf(null, 2), null)
})

test('지울 날은 행사 끝(없으면 시작, 없으면 양식 마감)의 한국 날짜 + 1년이다', () => {
  const closesAt = korean('2026-11-08T18:00:00')
  const startsAt = korean('2026-11-05T14:00:00')
  const endsAt = korean('2026-11-06T23:59:59')
  assert.equal(purgeOnOf({ eventEndsAt: endsAt, eventStartsAt: startsAt, closesAt }), '2027-11-06')
  assert.equal(purgeOnOf({ eventEndsAt: null, eventStartsAt: startsAt, closesAt }), '2027-11-05')
  assert.equal(purgeOnOf({ eventEndsAt: null, eventStartsAt: null, closesAt }), '2027-11-08')
  // 한국 날짜 기준이라 UTC로는 전날인 새벽도 그날이다.
  assert.equal(
    purgeOnOf({ eventEndsAt: korean('2026-11-06T00:30:00'), eventStartsAt: null, closesAt }),
    '2027-11-06',
  )
  assert.equal(
    purgeOnOf({ eventEndsAt: korean('2028-02-29T10:00:00'), eventStartsAt: null, closesAt }),
    '2029-03-01',
  )
})
