import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateFromKorean } from '@vada/contracts'
import { eventStatusOf } from './status.js'

const at = (value: string) => dateFromKorean(value)
const status = (starts: string | null, ends: string | null, now: string) =>
  eventStatusOf(starts ? at(starts) : null, ends ? at(ends) : null, at(now))

test('시작이 없으면 날짜 미정이다', () => {
  assert.equal(status(null, null, '2026-10-25T12:00'), 'tbd')
})

test('시작 전은 예정이고 시작 시각부터 진행 중이다(시작 ±1초)', () => {
  const starts = at('2026-10-25T14:00')
  const before = new Date(starts.getTime() - 1000)
  assert.equal(eventStatusOf(starts, null, before), 'upcoming')
  assert.equal(eventStatusOf(starts, null, starts), 'ongoing')
  assert.equal(eventStatusOf(starts, null, new Date(starts.getTime() + 1000)), 'ongoing')
})

test('끝이 있으면 끝 시각까지 진행 중이고 그 초가 지나면 끝남이다(끝 ±1초)', () => {
  const starts = at('2026-10-25T14:00')
  const ends = at('2026-10-25T18:00')
  assert.equal(eventStatusOf(starts, ends, new Date(ends.getTime() - 1000)), 'ongoing')
  assert.equal(eventStatusOf(starts, ends, ends), 'ongoing')
  assert.equal(eventStatusOf(starts, ends, new Date(ends.getTime() + 999)), 'ongoing')
  assert.equal(eventStatusOf(starts, ends, new Date(ends.getTime() + 1000)), 'ended')
})

test('끝이 없으면 시작한 날 한국 23:59:59까지 진행 중이고 한국 자정에 끝남이다', () => {
  const starts = at('2026-10-25T14:00')
  const midnight = at('2026-10-26T00:00')
  assert.equal(eventStatusOf(starts, null, new Date(midnight.getTime() - 1000)), 'ongoing')
  assert.equal(eventStatusOf(starts, null, new Date(midnight.getTime() - 1)), 'ongoing')
  assert.equal(eventStatusOf(starts, null, midnight), 'ended')
})

test('한국 자정 직후 시작은 그날 안에 끝나지 않은 것으로 센다', () => {
  const starts = at('2026-10-25T00:00')
  assert.equal(status('2026-10-25T00:00', null, '2026-10-25T23:59'), 'ongoing')
  assert.equal(eventStatusOf(starts, null, at('2026-10-26T00:00')), 'ended')
})
