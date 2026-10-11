// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventSummary, EventTasksResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import EventTasks from './EventTasks'
import { taskDetail, taskSummary } from './task-fixtures'
import { useEventTasks } from './useTasks'

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-11T03:00:00Z')) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
const event: EventSummary = { id: 'e1', organizationId: 'o1', name: '체육대회', createdBy: 'u1', createdAt: '2026-09-01T00:00:00Z',
  startsAt: '2026-10-20T10:00', endsAt: '2026-10-20T18:00', place: null, version: 1 }
const path = '/api/organizations/o1/events/e1/tasks'
const list: EventTasksResponse = { registrationClosesAt: '2026-10-18T23:59', tasks: [
  taskSummary({ id: 't1', title: '대관 신청', dueOn: '2026-10-05' }),
  taskSummary({ id: 't2', title: '현수막 디자인', status: 'doing', assignee: { membershipId: 'm1', name: '테스터' } }),
  taskSummary({ id: 't3', title: '참가자 명단 확정', assignee: null, department: null, dueOn: null }),
  taskSummary({ id: 't4', title: '포스터', status: 'done', completedAt: '2026-10-03T00:00:00Z', dueOn: '2026-10-03' })] }
const onChanged = vi.fn()
function Harness({ manageEvents }: { manageEvents: boolean }) {
  const state = useEventTasks('o1', 'e1', true)
  return <EventTasks organizationId="o1" event={event} manageEvents={manageEvents} viewerMembershipId="m1" state={state} onChanged={onChanged} />
}
function setup(manageEvents = true) {
  const api = mockApi()
  api.on('GET', path, () => json(list))
  render(<Harness manageEvents={manageEvents} />)
  return api
}
const titles = (scope: HTMLElement) => within(scope).queryAllByRole('heading', { level: 3 }).map(item => item.textContent)

test('요약은 D-day·완료 수·칩을 보이고, 보드는 세 열에 카드를 나눈다. 칩을 누르면 거른다', async () => {
  setup()
  expect(await screen.findByText('D-9')).toBeTruthy()
  expect(screen.getByText('완료 1/4')).toBeTruthy()
  const [todo, doing, done] = ['예정', '진행 중', '완료'].map(name => screen.getByRole('region', { name }))
  expect(titles(todo!)).toEqual(['대관 신청', '참가자 명단 확정'])
  expect(titles(doing!)).toEqual(['현수막 디자인'])
  expect(titles(done!)).toEqual(['포스터'])
  expect(within(todo!).getByText('10.5 · 지연')).toBeTruthy()
  expect(within(todo!).getByText('담당자 없음')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '지연 1' }))
  expect(screen.getByRole('button', { name: '지연 1' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByText('참가자 명단 확정')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '내 담당 1' }))
  expect(titles(document.body)).toEqual(['현수막 디자인'])
  fireEvent.click(screen.getByRole('button', { name: '내 담당 1' }))
  expect(titles(document.body)).toHaveLength(4)
})

test('카드의 시작 버튼은 상태를 진행 중으로 바꾸고 바뀌었다고 알린다', async () => {
  const api = setup()
  api.on('POST', `${path}/t1/status`, () => json({ task: taskDetail({ id: 't1', title: '대관 신청', dueOn: '2026-10-05', status: 'doing', version: 2 }) }))
  const todo = await screen.findByRole('region', { name: '예정' })
  fireEvent.click(within(todo).getAllByRole('button', { name: '시작' })[0]!)
  await waitFor(() => expect(titles(screen.getByRole('region', { name: '진행 중' }))).toContain('대관 신청'))
  expect(api.calls.at(-1)?.body).toEqual({ version: 1, status: 'doing' })
  expect(onChanged).toHaveBeenCalled()
})

test('일정 보기는 날짜별로 행사·신청 마감·업무를 보이고 지난 일정은 접어 둔다', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: '일정' }))
  const upcoming = screen.getByRole('region', { name: '다가오는 일정' })
  expect(within(upcoming).getByText('참가 신청 마감')).toBeTruthy()
  expect(within(upcoming).getByText('10:00~18:00')).toBeTruthy()
  expect(within(upcoming).getByRole('button', { name: '현수막 디자인' })).toBeTruthy()
  expect(screen.queryByText('대관 신청')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '지난 일정 2개 보기' }))
  expect(within(screen.getByRole('region', { name: '지난 일정' })).getByRole('button', { name: '대관 신청' })).toBeTruthy()
})

test('업무 추가를 누르면 구성원 목록을 불러와 대화상자를 연다. 미배정은 추가·시작 버튼이 없다', async () => {
  const api = setup()
  api.on('GET', '/api/organizations/o1/members', () => json({ viewer: {}, departments: [], members: [] }))
  fireEvent.click(await screen.findByRole('button', { name: '업무 추가' }))
  expect(await screen.findByRole('dialog', { name: '업무 추가' })).toBeTruthy()
  await waitFor(() => expect(api.calls.some(call => call.path === '/api/organizations/o1/members')).toBe(true))
  cleanup()
  setup(false)
  await screen.findByText('완료 1/4')
  expect(screen.queryByRole('button', { name: '업무 추가' })).toBeNull()
  expect(screen.queryByRole('button', { name: '시작' })).toBeNull()
})

test('업무가 없으면 빈 상태를 보인다', async () => {
  const api = mockApi()
  api.on('GET', path, () => json({ tasks: [], registrationClosesAt: null }))
  render(<Harness manageEvents />)
  expect(await screen.findByText('아직 업무가 없어요')).toBeTruthy()
})
