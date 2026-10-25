import assert from 'node:assert/strict'
import { test } from 'node:test'
import { semesterOf } from './semester.js'

test('semesterOf: 그 날이 든 학기의 이름과 날짜(1학기 1/1~6/30, 2학기 7/1~12/31)를 준다', () => {
  assert.deepEqual(semesterOf('2026-04-15'), {
    name: '2026년 1학기',
    startsOn: '2026-01-01',
    endsOn: '2026-06-30',
  })
  assert.deepEqual(semesterOf('2026-10-26'), {
    name: '2026년 2학기',
    startsOn: '2026-07-01',
    endsOn: '2026-12-31',
  })
})

test('semesterOf: 학기의 첫날과 끝날이 그 학기에 든다', () => {
  assert.equal(semesterOf('2027-01-01').name, '2027년 1학기')
  assert.equal(semesterOf('2027-06-30').name, '2027년 1학기')
  assert.equal(semesterOf('2027-07-01').name, '2027년 2학기')
  assert.equal(semesterOf('2027-12-31').name, '2027년 2학기')
})
