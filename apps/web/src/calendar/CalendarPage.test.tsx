// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { eventSummary } from '@/test-support/event-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import CalendarPage from './CalendarPage'

const TASK_ID = '0199d1a0-0000-7000-8000-0000000000a1'
const EVENT_ID = '0199d1a0-0000-7000-8000-0000000000e1'
const base = `/api/organizations/${COUNCIL_ID}`
const task: TaskSummary = {
  id: TASK_ID,
  title: '현수막 주문',
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-28',
  overdue: false,
  department: null,
  event: null,
  assignee: null,
  actions: ['task.change_status', 'task.change_assignee'],
}
const event = eventSummary({ id: EVENT_ID, name: '가을 축제', startsAt: '2026-10-28T14:00' })
let api: ReturnType<typeof mockApi>
const forbidden = vi.fn()
const page = () => <CalendarPage view={councilView(COUNCIL_ID)} onForbidden={forbidden} />
const selectedDay = () => screen.getByRole('region', { name: '10월 28일 (수)' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T03:00:00Z'))
  forbidden.mockClear()
  window.history.replaceState(null, '', `/calendar/${COUNCIL_ID}`)
  api = mockApi()
  api.on('GET', `${base}/tasks?view=all&status=open`, () =>
    json({ tasks: [task], truncated: false }),
  )
  api.on('GET', `${base}/events`, () => json({ events: [event], truncated: false }))
})
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('학생회 전체의 열린 업무 마감과 행사를 오늘 월에 모으고 수정 동작은 없다', async () => {
  render(page())
  await screen.findByRole('button', { name: '10월 28일 (수) 업무 1개, 행사 1개' })
  expect(screen.getByRole('heading', { name: '2026년 10월' })).toBeTruthy()
  expect(within(selectedDay()).getByRole('button', { name: task.title })).toBeTruthy()
  expect(within(selectedDay()).getByRole('button', { name: event.name })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^(시작|끝내기|업무 추가|마감 없음)/ })).toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(api.calls.every(call => call.method === 'GET')).toBe(true)
  expect(api.calls.some(call => call.path.includes('status=done'))).toBe(false)
})

test('전체·행사·마감 칩은 월과 고른 날짜를 보존하며 월 칸과 날짜 목록을 함께 거른다', async () => {
  render(page())
  await screen.findByRole('button', { name: '10월 28일 (수) 업무 1개, 행사 1개' })
  const chips = screen.getByRole('group', { name: '일정 유형' })
  fireEvent.click(within(chips).getByRole('button', { name: '행사' }))
  expect(screen.getByRole('button', { name: '10월 28일 (수) 업무 0개, 행사 1개' })).toBeTruthy()
  expect(within(selectedDay()).queryByText(task.title)).toBeNull()
  fireEvent.click(within(chips).getByRole('button', { name: '마감' }))
  expect(screen.getByRole('button', { name: '10월 28일 (수) 업무 1개, 행사 0개' })).toBeTruthy()
  expect(within(selectedDay()).queryByText(event.name)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  fireEvent.click(within(chips).getByRole('button', { name: '전체' }))
  expect(screen.getByRole('heading', { name: '2026년 11월' })).toBeTruthy()
})

test.each([
  ['업무', task.title, `/tasks/${COUNCIL_ID}/${TASK_ID}`],
  ['행사', event.name, `/events/${COUNCIL_ID}/${EVENT_ID}`],
])('%s 줄은 원본 상세 주소로 간다', async (_kind, name, path) => {
  render(page())
  await screen.findByRole('button', { name: '10월 28일 (수) 업무 1개, 행사 1개' })
  fireEvent.click(within(selectedDay()).getByRole('button', { name }))
  await waitFor(() => expect(window.location.pathname).toBe(path))
})

test('행사를 읽기 전에는 일정 0건을 지어내지 않는다', async () => {
  const pending = deferredResponse()
  api.on('GET', `${base}/events`, () => pending.promise)
  render(page())
  expect(await screen.findByText('일정 불러오는 중…')).toBeTruthy()
  expect(screen.queryByText('일정 없음')).toBeNull()
  pending.resolve(json({ events: [], truncated: false }))
  await screen.findByRole('button', { name: '10월 28일 (수) 업무 1개, 행사 0개' })
})

test.each(['tasks?view=all&status=open', 'events'])(
  '%s 실패는 다시 시도할 수 있고 403은 학생회를 다시 읽는다',
  async path => {
    api.on('GET', `${base}/${path}`, () => json({ error: 'FORBIDDEN' }, 403))
    render(page())
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(forbidden).toHaveBeenCalled()
    expect(screen.queryByText('일정 없음')).toBeNull()
    api.on('GET', `${base}/${path}`, () =>
      json(path === 'events' ? { events: [], truncated: false } : { tasks: [], truncated: false }),
    )
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull())
  },
)

test('빈 날은 회색 0건이며, 상한으로 잘린 목록은 알린다', async () => {
  api.on('GET', `${base}/tasks?view=all&status=open`, () => json({ tasks: [], truncated: true }))
  api.on('GET', `${base}/events`, () => json({ events: [], truncated: true }))
  render(page())
  expect(await screen.findByText('일정 없음')).toBeTruthy()
  expect(within(selectedDay()).getByText('0건').className).toContain('text-gray-500')
  expect(screen.getByText(/업무가 많아/)).toBeTruthy()
  expect(screen.getByText(/행사가 많아/)).toBeTruthy()
})
