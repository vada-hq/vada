import { expect, test } from 'vitest'
import { eventPhaseOf } from './event-phase'

const event = (startsAt: string | null, endsAt: string | null = null, completedAt: string | null = null) => ({ startsAt, endsAt, completedAt })

test('날짜가 없거나 시작 전이면 기획 중이다', () => {
  expect(eventPhaseOf(event(null), '2026-10-12T09:00')).toBe('planning')
  expect(eventPhaseOf(event('2026-10-20T10:00', '2026-10-20T18:00'), '2026-10-20T09:59')).toBe('planning')
})

test('끝 일시가 있으면 시작 정각부터 끝 전까지 진행 중이고, 끝 정각부터 정리 중이다', () => {
  const sports = event('2026-10-20T10:00', '2026-10-21T18:00')
  expect(eventPhaseOf(sports, '2026-10-20T10:00')).toBe('ongoing')
  expect(eventPhaseOf(sports, '2026-10-21T17:59')).toBe('ongoing')
  expect(eventPhaseOf(sports, '2026-10-21T18:00')).toBe('wrapping')
})

test('끝 일시가 없으면 시작한 날(한국 날짜)이 끝날 때까지 진행 중이다', () => {
  const opening = event('2026-10-20T18:00')
  expect(eventPhaseOf(opening, '2026-10-20T23:59')).toBe('ongoing')
  expect(eventPhaseOf(opening, '2026-10-21T00:00')).toBe('wrapping')
})

test('완료한 행사는 날짜와 상관없이 완료다', () => {
  expect(eventPhaseOf(event('2999-01-01T10:00', null, '2026-10-12T00:00:00.000Z'), '2026-10-12T09:00')).toBe('completed')
  expect(eventPhaseOf(event(null, null, '2026-10-12T00:00:00.000Z'), '2026-10-12T09:00')).toBe('completed')
})
