// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TASK_DONE_LIMIT, type TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { withTaskLayout } from '@/lib/task-layout'
import TasksPage from './TasksPage'

const base = `/api/organizations/${COUNCIL_ID}/tasks`
const listPath = (status: string, event = '') =>
  `${base}?view=${event ? 'all' : 'mine'}&status=${status}${event ? `&event=${event}` : ''}`
const pathNow = () => window.location.pathname + window.location.search

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: `업무 ${id}`,
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: false,
  department: { id: 'd1', name: '재정부' },
  event: null,
  assignee: { id: 'm2', name: '이재정', current: true },
  actions: ['task.change_status'],
  ...extra,
})
const list = (tasks: TaskSummary[], truncated = false) => json({ tasks, truncated })

function wide(matches = true) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

let api: ReturnType<typeof mockApi>
function serve(open: TaskSummary[], done: TaskSummary[] = [], event = '') {
  api = mockApi()
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(teamResponse()))
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({ events: [], truncated: false }),
  )
  const options = json({
    departments: [{ id: null, name: null, assignees: [{ id: 'm1', name: '김회장' }] }],
    linkableEvents: [],
  })
  api.on('GET', `${base}/options`, () => options.clone())
  api.on('GET', `${base}/options?event=${EVENT_ID}`, () => options.clone())
  api.on('GET', listPath('open', event), () => list(open))
  api.on('GET', listPath('done', event), () => list(done))
  return api
}

const page = (eventId?: string) => (
  <TasksPage
    view={councilView(COUNCIL_ID)}
    eventId={eventId}
    onForbidden={() => {}}
    onChanged={() => {}}
  />
)
const column = (name: string) => screen.findByRole('region', { name: new RegExp(`^${name}`) })
const cards = (region: HTMLElement) => within(region).queryAllByRole('listitem')

beforeEach(() => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  window.localStorage.clear()
  wide()
})
afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

test('넓은 화면의 기본은 열 셋(할 일·진행 중·끝남) 보드이고, 열 머리 수가 그 열의 카드 수다', async () => {
  serve(
    [task('a'), task('b', { status: 'in_progress', next: 'done' }), task('c')],
    [task('d', { status: 'done', next: null })],
  )
  render(page())
  const todo = await column('할 일')
  await waitFor(() => expect(cards(todo)).toHaveLength(2))
  expect(todo.getAttribute('aria-label') ?? todo.textContent).toContain('2')
  expect(within(todo).getByText('2')).toBeTruthy()
  const doing = await column('진행 중')
  expect(cards(doing)).toHaveLength(1)
  const done = await column('끝남')
  await waitFor(() => expect(cards(done)).toHaveLength(1))
  expect(screen.queryByRole('region', { name: /검토/ })).toBeNull()
  expect(screen.queryByRole('grid')).toBeNull()
})

test('카드에 업무명, 부서 칩, 지남 칩, 담당자, 마감이 있고 행사 이름은 없다', async () => {
  serve([
    task('a', { event: { id: EVENT_ID, name: '신입생 환영회' } }),
    task('b', { overdue: true, assignee: null, department: null }),
    task('c', { assignee: { id: 'm9', name: '떠난이', current: false }, dueDate: null }),
  ])
  render(page())
  const a = (await screen.findByRole('button', { name: '업무 a' })).closest('li')!
  expect(within(a).getByText('재정부')).toBeTruthy()
  expect(within(a).getByText('이재정')).toBeTruthy()
  expect(within(a).getByText('10월 25일')).toBeTruthy()
  expect(a.textContent).not.toContain('신입생 환영회')
  expect(within(a).queryByText('지남')).toBeNull()
  const b = screen.getByRole('button', { name: '업무 b' }).closest('li')!
  expect(within(b).getByText('학생회 업무')).toBeTruthy()
  expect(within(b).getByText('지남')).toBeTruthy()
  expect(within(b).getByText('담당자 없음')).toBeTruthy()
  expect(within(b).getByText('10월 25일 · 지남')).toBeTruthy()
  const c = screen.getByRole('button', { name: '업무 c' }).closest('li')!
  expect(within(c).getByText('떠난 사람: 떠난이')).toBeTruthy()
  expect(within(c).getByText('마감 없음')).toBeTruthy()
})

test('카드를 누르면 그 업무 주소로 상세를 연다', async () => {
  serve([task('a')])
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '업무 a' }))
  await waitFor(() => expect(window.location.pathname).toBe(`/tasks/${COUNCIL_ID}/a`))
})

test('카드 ⋯ 메뉴에 지금 상태가 아닌 둘이 있고 고르면 상태를 바꾼다. 상태를 바꿀 수 없으면 메뉴가 없다', async () => {
  serve([task('a'), task('b', { actions: [] })])
  api.on('POST', `${base}/a/status`, () => json({ task: task('a', { status: 'done' }) }))
  render(page())
  fireEvent.keyDown(await screen.findByRole('button', { name: '업무 a 더 보기' }), { key: 'Enter' })
  const items = await screen.findAllByRole('menuitem')
  expect(items.map(item => item.textContent)).toEqual(['진행 중으로', '끝남으로'])
  fireEvent.click(screen.getByRole('menuitem', { name: '끝남으로' }))
  await waitFor(() =>
    expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ status: 'done' }),
  )
  expect(screen.queryByRole('button', { name: '업무 b 더 보기' })).toBeNull()
})

test('끝난 업무가 넘치면 끝남 열에 50장과 50+가 있고, [표로 보기]가 표의 끝남을 연다', async () => {
  const done = Array.from({ length: TASK_DONE_LIMIT }, (_, index) =>
    task(`d${index}`, { status: 'done', next: null }),
  )
  serve([task('a')])
  api.on('GET', listPath('done'), () => list(done, true))
  render(page())
  const column50 = await column('끝남')
  await waitFor(() => expect(cards(column50)).toHaveLength(TASK_DONE_LIMIT))
  expect(within(column50).getByText('50+')).toBeTruthy()
  fireEvent.click(within(column50).getByRole('button', { name: '표로 보기' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?filter=done&layout=list`))
})

test('끝나지 않은 목록이 넘치면 그 열의 수 뒤에 +가 있다', async () => {
  serve([])
  api.on('GET', listPath('open'), () => list([task('a')], true))
  render(page())
  const todo = await column('할 일')
  await waitFor(() => expect(within(todo).getByText('1+')).toBeTruthy())
})

const allPath = (status: string) => `${base}?view=all&status=${status}`

test('업무가 없으면 보드 위에 빈 상태와 빈 열이 있고, [첫 업무 추가]는 새 업무 칸에 초점을 둔다', async () => {
  serve([])
  api.on('GET', allPath('open'), () => list([]))
  api.on('GET', allPath('done'), () => list([]))
  render(page())
  expect(await screen.findByText('업무 없음')).toBeTruthy()
  for (const name of ['할 일', '진행 중', '끝남']) expect(cards(await column(name))).toHaveLength(0)
  fireEvent.click(await screen.findByRole('button', { name: '첫 업무 추가' }))
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '새 업무' }))
})

test('학생회에 업무가 있는데 이 보기에서 비면 그 보기의 빈 문구이고 [첫 업무 추가]가 없다', async () => {
  serve([])
  api.on('GET', allPath('open'), () => list([]))
  api.on('GET', allPath('done'), () => list([task('d', { status: 'done', next: null })]))
  render(page())
  expect(await screen.findByText('내 업무 없음')).toBeTruthy()
  expect(screen.queryByText('업무 없음')).toBeNull()
  expect(screen.queryByRole('button', { name: '첫 업무 추가' })).toBeNull()
})

test('배치 고르기는 보드·표·달력이고, 표를 고르면 018 표이며 이 기기에 기억한다', async () => {
  serve([task('a')])
  render(page())
  const group = await screen.findByRole('group', { name: '보기 모양' })
  expect(
    within(group)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['보드', '표', '달력'])
  expect(within(group).getByRole('button', { name: '보드' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  fireEvent.click(within(group).getByRole('button', { name: '표' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?layout=list`))
  expect(await screen.findByRole('grid', { name: '업무 표' })).toBeTruthy()
  expect(withTaskLayout('m1', {})).toEqual({ layout: 'list' })
})

test('행사의 업무 탭도 같은 보드다', async () => {
  window.history.replaceState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks`)
  serve([task('a', { event: { id: EVENT_ID, name: '신입생 환영회' } })], [], EVENT_ID)
  render(page(EVENT_ID))
  const todo = await column('할 일')
  await waitFor(() => expect(cards(todo)).toHaveLength(1))
  expect(todo.textContent).not.toContain('신입생 환영회')
})

test('행사의 업무 탭 달력에는 그 행사만 있다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T03:00:00Z'))
  window.history.replaceState(
    null,
    '',
    `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks&layout=calendar`,
  )
  serve([], [], EVENT_ID)
  const day = { startsAt: '2026-10-30T14:00', endsAt: '2026-10-30T18:00' }
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({
      events: [
        eventSummary({ ...day }),
        eventSummary({ ...day, id: '00000000-0000-4000-8000-0000000000e2', name: '체육대회' }),
      ],
      truncated: false,
    }),
  )
  render(page(EVENT_ID))
  expect(
    await screen.findByRole('button', { name: '10월 30일 (금) 업무 0개, 행사 1개' }),
  ).toBeTruthy()
  vi.useRealTimers()
})
