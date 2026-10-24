import { expect, test } from 'vitest'
import type { EventSummary } from '@vada/contracts'
import { dateBlock, dayLabel, eventGroups, spanLabel, whenLabel } from './event-view'

test('일시는 요일과 함께 한 줄로 보인다', () => {
  expect(whenLabel({ startsAt: '2026-10-25T14:00', endsAt: '2026-10-25T18:00' })).toBe(
    '10월 25일 (일) 14:00 ~ 18:00',
  )
  expect(whenLabel({ startsAt: '2026-10-24T14:00', endsAt: null })).toBe('10월 24일 (토) 14:00')
})

test('끝이 다른 날이면 끝에도 날짜를 쓰고, 시작이 없으면 날짜 미정이다', () => {
  expect(whenLabel({ startsAt: '2026-10-24T20:00', endsAt: '2026-10-25T02:00' })).toBe(
    '10월 24일 (토) 20:00 ~ 10월 25일 (일) 02:00',
  )
  expect(whenLabel({ startsAt: null, endsAt: null })).toBe('날짜 미정')
})

test('목록의 날짜 칸은 시작한 달과 날이고, 시작이 없으면 비운다', () => {
  expect(dateBlock('2026-11-01T18:00')).toEqual({ month: '11월', day: '1' })
  expect(dateBlock('2026-10-15T09:30')).toEqual({ month: '10월', day: '15' })
  expect(dateBlock(null)).toBeNull()
})

test('날짜 칸 옆의 시각은 날짜를 되풀이하지 않고, 다른 날에 끝나면 끝의 날짜를 쓴다', () => {
  expect(spanLabel({ startsAt: '2026-11-01T18:00', endsAt: '2026-11-01T20:00' })).toBe(
    '일요일 18:00 ~ 20:00',
  )
  expect(spanLabel({ startsAt: '2026-11-01T18:00', endsAt: null })).toBe('일요일 18:00')
  expect(spanLabel({ startsAt: '2026-10-24T20:00', endsAt: '2026-10-25T02:00' })).toBe(
    '토요일 20:00 ~ 10월 25일 (일) 02:00',
  )
  expect(spanLabel({ startsAt: null, endsAt: null })).toBeNull()
})

test('목록은 다가오는 행사, 날짜 미정, 지난 행사로 묶고 빈 묶음은 뺀다', () => {
  const of = (id: string, status: EventSummary['status']) => ({ id, status }) as EventSummary
  const groups = eventGroups([
    of('a', 'ongoing'),
    of('b', 'upcoming'),
    of('c', 'ended'),
    of('d', 'completed'),
  ])
  expect(groups.map(group => [group.title, group.events.map(event => event.id)])).toEqual([
    ['다가오는 행사', ['a', 'b']],
    ['지난 행사', ['c', 'd']],
  ])
  expect(eventGroups([of('e', 'tbd')]).map(group => group.title)).toEqual(['날짜 미정'])
})

test('결재 날짜는 한국 날짜와 요일이고, 올해가 아니면 연도가 앞에 붙는다', () => {
  const now = new Date('2026-12-01T00:00:00Z')
  expect(dayLabel('2026-10-24T15:30:00.000Z', now)).toBe('10월 25일 (일)')
  expect(dayLabel('2025-12-31T14:59:00.000Z', now)).toBe('2025년 12월 31일 (수)')
})
