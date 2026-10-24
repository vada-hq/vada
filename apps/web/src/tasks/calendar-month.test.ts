import { expect, test } from 'vitest'
import type { EventSummary, TaskSummary } from '@vada/contracts'
import { eventSummary } from '@/test-support/event-fixtures'
import { dayLabel, eventBarsOf, eventsOn, shiftMonth, tasksByDay, weeksOf } from './calendar-month'

const event = (id: string, startsAt: string | null, endsAt: string | null = null): EventSummary =>
  eventSummary({ id, name: id, startsAt, endsAt })

const task = (title: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id: title,
  title,
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-28',
  overdue: false,
  department: null,
  event: null,
  assignee: null,
  actions: [],
  ...extra,
})

test('달은 해를 넘어 옮기고, 날 이름에 요일을 붙인다', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  expect(dayLabel('2026-10-25')).toBe('10월 25일 (일)')
})

test('주는 일요일에 시작하고 그 달의 앞뒤 날을 채운다', () => {
  const weeks = weeksOf('2026-10')
  expect(weeks).toHaveLength(5)
  expect(weeks[0]?.[0]).toBe('2026-09-27')
  expect(weeks[4]?.[6]).toBe('2026-10-31')
  // 1일이 일요일인 달은 앞 달 날이 없다.
  expect(weeksOf('2026-11')[0]?.[0]).toBe('2026-11-01')
})

test('행사는 시작일부터 끝일까지 걸치고, 일시가 없으면 달력에 없다', () => {
  const events = [event('mt', '2026-10-30T14:00', '2026-11-01T12:00'), event('미정', null)]
  expect(eventsOn(events, '2026-10-29')).toEqual([])
  expect(eventsOn(events, '2026-10-31').map(item => item.id)).toEqual(['mt'])
  expect(eventsOn(events, '2026-11-01').map(item => item.id)).toEqual(['mt'])
})

test('주를 넘는 행사 막대는 주 끝에서 잘리고, 겹치는 행사는 아래 줄로 내려간다', () => {
  const [, , , , last = []] = weeksOf('2026-10')
  const events = [
    event('mt', '2026-10-30T14:00', '2026-11-01T12:00'),
    event('회의', '2026-10-30T18:00'),
    event('축제', '2026-10-25T10:00', '2026-10-26T18:00'),
  ]
  const bars = eventBarsOf(events, last)
  expect(bars.map(bar => [bar.event.id, bar.start, bar.span, bar.lane])).toEqual([
    ['축제', 0, 2, 0],
    ['mt', 5, 2, 0],
    ['회의', 5, 1, 1],
  ])
  expect(bars.find(bar => bar.event.id === 'mt')).toMatchObject({ before: false, after: true })
  const [next = []] = weeksOf('2026-11')
  expect(eventBarsOf(events, next)[0]).toMatchObject({
    start: 0,
    span: 1,
    before: true,
    after: false,
  })
})

test('날마다 업무는 지남, 진행 중, 할 일, 끝남 순이고 같으면 제목 순이며, 마감 없는 업무는 없다', () => {
  const days = tasksByDay([
    task('끝', { status: 'done' }),
    task('나할일'),
    task('가할일'),
    task('지남', { overdue: true }),
    task('진행', { status: 'in_progress' }),
    task('없음', { dueDate: null }),
  ])
  expect(days.get('2026-10-28')?.map(item => item.title)).toEqual([
    '지남',
    '진행',
    '가할일',
    '나할일',
    '끝',
  ])
  expect([...days.keys()]).toEqual(['2026-10-28'])
})
