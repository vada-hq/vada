// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { HomeResponse, TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { EVENT_ID, eventDetail, eventSummary } from '@/test-support/event-fixtures'
import { homeResponse, homeTask, homeWithTasks, onHomeExtras } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'
import type { Page } from './pages'

const base = `/api/organizations/${COUNCIL_ID}`
const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const D1 = '0199d1a0-0000-7000-8000-0000000000d1'
const D2 = '0199d1a0-0000-7000-8000-0000000000d2'
const list = (view: string, status = 'open') => `${base}/tasks?view=${view}&status=${status}`
const pathNow = () => window.location.pathname + window.location.search

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: `업무 ${id.slice(0, 4)}`,
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: false,
  department: null,
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.change_status'],
  ...extra,
})
const T2 = '8a1b2c3d-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const planning = { id: D1, name: '기획부' }
const finance = { id: D2, name: '재정부' }

let api: ReturnType<typeof mockApi>
function setup(startPage: Page, home: HomeResponse = homeWithTasks([homeTask(T1, 'overdue')])) {
  api = mockApi()
  onHomeExtras(api, {}, COUNCIL_ID)
  api.on('GET', base, () =>
    json(
      councilView(COUNCIL_ID, {
        departments: [{ id: D1, name: '기획부', role: null, rank: 'head' }],
      }),
    ),
  )
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/home`, () => json(home))
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${base}/events/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', list('mine'), () => json({ tasks: [task(T1)], truncated: false }))
  api.on('GET', list('mine', 'done'), () => json({ tasks: [], truncated: false }))
  api.on('GET', list('all'), () =>
    json({
      tasks: [
        task(T1, { department: planning }),
        task(T2, { department: finance, title: '정산 업무' }),
      ],
      truncated: false,
    }),
  )
  api.on('GET', list('all', 'done'), () => json({ tasks: [], truncated: false }))
  api.on('GET', list('department'), () =>
    json({
      tasks: [
        task(T1, { department: planning }),
        task(T2, { department: finance, title: '정산 업무' }),
      ],
      truncated: false,
    }),
  )
  api.on('GET', `${base}/tasks/${T1}`, () =>
    json({
      task: taskDetail({
        id: T1,
        title: '현수막 주문',
        event: { id: EVENT_ID, name: '신입생 환영회' },
      }),
    }),
  )
  return render(<WorkspaceAt startPage={startPage} />)
}
const startAt = (path: string, page: Page = 'tasks') => {
  window.history.replaceState(null, '', path)
  return setup(page)
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const selected = (name: string) =>
  screen.findByRole('tab', { name }).then(tab => tab.getAttribute('aria-selected'))
const pushes = () => vi.spyOn(window.history, 'pushState')
const readsOf = (path: string) => api.calls.filter(call => call.path === path).length

test('보기 탭을 누르면 주소의 쿼리가 바뀌고 기록은 쌓이지 않으며, 기본 보기로 돌아오면 쿼리가 사라진다', async () => {
  startAt(`/tasks/${COUNCIL_ID}`)
  expect(await selected('내 업무')).toBe('true')
  const push = pushes()
  fireEvent.click(screen.getByRole('tab', { name: '전체' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all`))
  expect(await selected('전체')).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: '내 업무' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}`))
  expect(push).not.toHaveBeenCalled()
})

test('거르기와 배치도 주소에 남고 기본값은 남지 않는다', async () => {
  startAt(`/tasks/${COUNCIL_ID}?view=all`)
  expect(await selected('전체')).toBe('true')
  fireEvent.click(await screen.findByRole('button', { name: '끝남' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all&filter=done`))
  fireEvent.click(screen.getByRole('button', { name: '끝나지 않은 것' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all`))
  fireEvent.click(screen.getByRole('button', { name: '달력' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all&layout=calendar`))
  fireEvent.click(screen.getByRole('button', { name: '목록' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all`))
})

test('새로 고침하면 주소의 보기·거르기가 그대로 열린다', async () => {
  startAt(`/tasks/${COUNCIL_ID}?view=all&filter=done`)
  expect(await selected('전체')).toBe('true')
  await waitFor(() => expect(readsOf(list('all', 'done'))).toBeGreaterThan(0))
  expect(screen.getByRole('button', { name: '끝남' }).getAttribute('aria-pressed')).toBe('true')
})

test('모르는 값은 기본값으로 읽고 주소를 고쳐 쓴다', async () => {
  const push = (startAt(`/tasks/${COUNCIL_ID}?view=nope&filter=x&layout=y&dept=z`), pushes())
  expect(await selected('내 업무')).toBe('true')
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}`))
  expect(readsOf(list('mine'))).toBeGreaterThan(0)
  expect(push).not.toHaveBeenCalled()
})

test('끝 슬래시와 대문자 id는 읽은 꼴로 고쳐 쓴다', async () => {
  startAt(`/tasks/${COUNCIL_ID.toUpperCase()}/?view=all`)
  expect(await selected('전체')).toBe('true')
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all`))
})

test('부서 거르기는 주소에 남고 그 부서의 업무만 보이며, 풀면 주소에서 빠진다', async () => {
  startAt(`/tasks/${COUNCIL_ID}?view=department&dept=${D2}`)
  expect(await screen.findByText('정산 업무')).toBeTruthy()
  expect(screen.queryByText('업무 3f2b')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '재정부 거르기 풀기' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=department`))
  expect(await screen.findByText('업무 3f2b')).toBeTruthy()
})

test('보기 탭을 바꾸면 부서 거르기가 풀린다', async () => {
  startAt(`/tasks/${COUNCIL_ID}?view=department&dept=${D2}`)
  await screen.findByText('정산 업무')
  fireEvent.click(screen.getByRole('tab', { name: '전체' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all`))
})

test('목록에서 업무를 열면 /tasks/학생회/업무로 한 칸 쌓이고, 닫으면 같은 보기의 목록으로 돌아간다', async () => {
  startAt(`/tasks/${COUNCIL_ID}?view=all`)
  const push = pushes()
  fireEvent.click(await screen.findByRole('button', { name: '업무 3f2b' }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('현수막 주문')
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}/${T1}`)
  expect(push).toHaveBeenCalledTimes(1)
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await act(() => windowHistoryIdle())
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all`)
  expect(await selected('전체')).toBe('true')
})

test('홈에서 연 업무를 닫으면 홈으로 돌아간다', async () => {
  setup('home')
  fireEvent.click(await screen.findByRole('button', { name: /업무 3f2b/ }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('현수막 주문')
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}/${T1}`)
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await act(() => windowHistoryIdle())
  expect(pathNow()).toBe(`/home/${COUNCIL_ID}`)
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
})

test('업무 상세에서 누른 행사는 행사 주소로 열리고, 뒤로 가면 그 업무 상세다', async () => {
  startAt(`/tasks/${COUNCIL_ID}?view=all`)
  fireEvent.click(await screen.findByRole('button', { name: '업무 3f2b' }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('현수막 주문')
  fireEvent.click(within(dialog).getByRole('button', { name: '신입생 환영회' }))
  expect(await screen.findByRole('heading', { level: 1, name: '행사' })).toBeTruthy()
  await act(() => windowHistoryIdle())
  expect(pathNow()).toBe(`/events/${COUNCIL_ID}/${EVENT_ID}`)
  act(() => window.history.back())
  const back = await screen.findByRole('dialog')
  await within(back).findByText('현수막 주문')
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}/${T1}`)
})

const council = (extra: Partial<NonNullable<HomeResponse['council']>> = {}) => ({
  events: [],
  truncated: false,
  endedTotal: 0,
  blocked: [],
  overdue: { tasks: [], total: 0 },
  unassignedMembers: 0,
  ...extra,
})

test('홈의 내 업무 모두 보기는 내 업무(기본)로 연다', async () => {
  setup('home')
  fireEvent.click(await screen.findByRole('button', { name: '모두 보기' }))
  expect(await selected('내 업무')).toBe('true')
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}`)
})

test('내 부서 묶음의 모두 보기는 내 부서 보기에 그 부서 거르기로 연다', async () => {
  setup(
    'home',
    homeResponse({
      departments: [
        {
          id: D1,
          name: '기획부',
          counts: { todo: 1, inProgress: 0, overdue: 1, unassigned: 0 },
          overdue: { tasks: [task(T1, { overdue: true })], total: 1 },
          unassigned: { tasks: [], total: 0 },
        },
      ],
    }),
  )
  const section = await screen.findByRole('region', { name: '기획부' })
  fireEvent.click(within(section).getByRole('button', { name: '모두 보기' }))
  expect(await selected('내 부서')).toBe('true')
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=department&dept=${D1}`)
})

test('회장단의 지난 업무 모두 보기는 전체 보기로 연다', async () => {
  setup(
    'home',
    homeResponse({
      council: council({
        overdue: { tasks: [task(T2, { overdue: true, title: '지난 일' })], total: 1 },
      }),
    }),
  )
  const section = await screen.findByRole('region', { name: '지난 업무' })
  fireEvent.click(within(section).getByRole('button', { name: '모두 보기' }))
  expect(await selected('전체')).toBe('true')
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all`)
})

test('회장단의 부서별 막힌 곳 줄은 전체 보기에 그 부서 거르기로 연다', async () => {
  setup(
    'home',
    homeResponse({
      council: council({ blocked: [{ department: planning, overdue: 1, unassigned: 0 }] }),
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '기획부' }))
  expect(await selected('전체')).toBe('true')
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all&dept=${D1}`)
})

test('상세를 여는 동안 뒤의 목록은 보던 보기와 부서 거르기를 지키고, 닫으면 같은 보기다', async () => {
  startAt(`/tasks/${COUNCIL_ID}?view=all&dept=${D1}`)
  fireEvent.click(await screen.findByRole('button', { name: '업무 3f2b' }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('현수막 주문')
  expect(screen.getByRole('button', { name: '기획부 거르기 풀기', hidden: true })).toBeTruthy()
  expect(
    screen.getByRole('tab', { name: '전체', hidden: true }).getAttribute('aria-selected'),
  ).toBe('true')
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await act(() => windowHistoryIdle())
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all&dept=${D1}`)
})

test('연 업무가 사라져도 보던 보기와 부서 거르기가 남는다', async () => {
  startAt(`/tasks/${COUNCIL_ID}?view=all&dept=${D1}`)
  api.on('GET', `${base}/tasks/${T1}`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '업무 3f2b' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/업무/)
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?view=all&dept=${D1}`))
  expect(screen.getByRole('tab', { name: '전체' }).getAttribute('aria-selected')).toBe('true')
})

test('내 부서가 아닌 부서 거르기도 홈이 알려 준 부서 이름으로 칩을 쓴다', async () => {
  const D3 = '0199d1a0-0000-7000-8000-0000000000d3'
  setup(
    'home',
    homeResponse({
      council: council({
        blocked: [{ department: { id: D3, name: '디자인부' }, overdue: 1, unassigned: 0 }],
      }),
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '디자인부' }))
  const chip = await screen.findByRole('button', { name: '디자인부 거르기 풀기' })
  expect(chip.className).toContain('wrap-anywhere')
})
