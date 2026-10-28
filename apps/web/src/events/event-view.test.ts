import { expect, test } from 'vitest'
import { eventSummary } from '@/test-support/event-fixtures'
import { prioritizeEvents, visibleEvents, whenLabel } from './event-view'

test('휴대폰 목록은 옆 메뉴의 행사 다섯을 먼저 두고 나머지 차례를 보존한다', () => {
  const events = ['ended', 'upcoming', 'tbd', 'ongoing', 'completed', 'other'].map(id =>
    eventSummary({ id }),
  )
  const priority = ['ongoing', 'upcoming', 'tbd', 'missing', 'ended'].map(id => ({ id }))
  expect(prioritizeEvents(events, priority).map(event => event.id)).toEqual([
    'ongoing',
    'upcoming',
    'tbd',
    'ended',
    'completed',
    'other',
  ])
  expect(prioritizeEvents(events, []).map(event => event.id)).toEqual(events.map(event => event.id))
  expect(events[0]!.id).toBe('ended')
})

test('일시는 요일과 함께 한 줄로 보인다', () => {
  expect(whenLabel({ startsAt: '2026-10-25T14:00', endsAt: '2026-10-25T18:00' })).toBe(
    '10월 25일 (일) 14:00 ~ 18:00',
  )
  expect(whenLabel({ startsAt: '2026-10-24T14:00', endsAt: null })).toBe('10월 24일 (토) 14:00')
})

test('끝이 다른 날이면 끝에도 날짜를 쓰고, 시작이 없으면 일시 미정이다', () => {
  expect(whenLabel({ startsAt: '2026-10-24T20:00', endsAt: '2026-10-25T02:00' })).toBe(
    '10월 24일 (토) 20:00 ~ 10월 25일 (일) 02:00',
  )
  expect(whenLabel({ startsAt: null, endsAt: null })).toBe('일시 미정')
})

test('기획 중은 예정과 날짜 미정을 함께 거르고 찾기는 공백과 영문 대소문자를 무시한다', () => {
  const events = [
    eventSummary({ id: 'a', name: 'MT', status: 'upcoming' }),
    eventSummary({ id: 'b', name: 'mt 미정', status: 'tbd', startsAt: null }),
    eventSummary({ id: 'c', name: 'MT 종료', status: 'ended' }),
  ]
  expect(visibleEvents(events, ' mt ', '기획 중', 'date').map(event => event.id)).toEqual([
    'a',
    'b',
  ])
  expect(visibleEvents(events, '', '후속 정리 중', 'date').map(event => event.id)).toEqual(['c'])
  expect(visibleEvents(events, '', '진행 중', 'date')).toEqual([])
  expect(visibleEvents(events, '', '전체', 'date')).toEqual(events)
})

test('최근 활동순은 수정 시각의 내림차순이고 원본과 동률 차례를 보존한다', () => {
  const events = [
    eventSummary({ id: 'a' }),
    eventSummary({ id: 'b', updatedAt: '2026-10-25T00:00:00Z' }),
    eventSummary({ id: 'c' }),
  ]
  expect(visibleEvents(events, '', '전체', 'activity').map(event => event.id)).toEqual([
    'b',
    'a',
    'c',
  ])
  expect(events.map(event => event.id)).toEqual(['a', 'b', 'c'])
})
