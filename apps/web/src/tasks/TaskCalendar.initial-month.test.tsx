// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { eventSummary } from '@/test-support/event-fixtures'
import { TaskCalendarBody } from './TaskCalendarBody'

type Props = ComponentProps<typeof TaskCalendarBody>
const eventId = 'event-a'
const event = eventSummary({
  id: eventId,
  startsAt: '2027-02-01T00:10',
  endsAt: '2027-03-01T00:10',
})
const noop = () => {}
const taskList = {
  state: { kind: 'ready' as const, tasks: [], truncated: false },
  reload: async () => {},
}
const events = (items = [event]): Props['events'] => ({
  state: { kind: 'ready', data: { events: items, truncated: false } },
  reload: async () => {},
  replace: noop,
})
const defaults = {
  open: taskList,
  done: taskList,
  events: events(),
  view: 'all' as const,
  change: { busy: new Set<string>(), errors: {}, change: async () => {} },
  assign: { busy: new Set<string>(), errors: {}, assign: async () => {} },
  team: null,
  inEvent: true,
  onOpenTask: noop,
}
const body = (props: Partial<Props>) => <TaskCalendarBody {...defaults} {...props} />
const month = (name: string) => screen.getByRole('heading', { name })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-31T15:01:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('행사는 한국 시각 시작 월과 시작일을 먼저 보여 주고, 오늘은 실제 오늘로 간다', () => {
  render(body({ eventId }))
  expect(month('2027년 2월')).toBeTruthy()
  expect(screen.getByRole('region', { name: '2월 1일 (월)' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '오늘' }))
  expect(month('2027년 1월')).toBeTruthy()
  expect(screen.getByRole('region', { name: '1월 1일 (금)' })).toBeTruthy()
})

test.each([
  [null, '2027-03-01T00:10', '2027년 3월'],
  [null, null, '2027년 1월'],
])('시작 %s / 종료 %s의 기본은 %s', (startsAt, endsAt, expected) => {
  render(body({ eventId, events: events([eventSummary({ id: eventId, startsAt, endsAt })]) }))
  expect(month(expected)).toBeTruthy()
})

test('전체 업무 달력은 행사 일시가 있어도 한국 시각 오늘 월이다', () => {
  render(body({ inEvent: false }))
  expect(month('2027년 1월')).toBeTruthy()
})

test('행사 목록을 늦게 읽어도 기본 월을 맞추고 사람이 넘긴 월은 재조회로 바꾸지 않는다', () => {
  const pending: Props['events'] = { ...events(), state: { kind: 'loading' } }
  const view = render(body({ eventId, events: pending }))
  view.rerender(body({ eventId }))
  expect(month('2027년 2월')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  view.rerender(
    body({
      eventId,
      events: events([eventSummary({ id: eventId, startsAt: '2027-05-01T10:00' })]),
    }),
  )
  expect(month('2027년 3월')).toBeTruthy()
})

test('행사 일시보다 먼저 사람이 달을 넘겼으면 늦은 응답은 그 선택을 보존한다', () => {
  const pending: Props['events'] = { ...events(), state: { kind: 'loading' } }
  const view = render(body({ eventId, events: pending }))
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  view.rerender(
    body({
      eventId,
      events: events([eventSummary({ id: eventId, startsAt: '2027-05-01T10:00' })]),
    }),
  )
  expect(month('2027년 2월')).toBeTruthy()
})

test('행사를 바꾸면 이전 행사에서 넘긴 월 대신 새 행사 월로 시작한다', () => {
  const view = render(body({ eventId }))
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  view.rerender(
    body({
      eventId: 'event-b',
      events: events([eventSummary({ id: 'event-b', startsAt: '2027-06-01T10:00' })]),
    }),
  )
  expect(month('2027년 6월')).toBeTruthy()
})

test('이미 읽은 상세 일시는 행사 목록이 아직 없거나 상한에서 빠져도 쓴다', () => {
  render(body({ eventId, calendarEvent: event, events: events([]) }))
  expect(month('2027년 2월')).toBeTruthy()
})

test('행사를 바꾼 뒤 남은 이전 상세 일시는 새 행사 기본값에 쓰지 않는다', () => {
  render(
    body({
      eventId: 'event-b',
      calendarEvent: event,
      events: events([eventSummary({ id: 'event-b', startsAt: '2027-06-01T10:00' })]),
    }),
  )
  expect(month('2027년 6월')).toBeTruthy()
})
