// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { EVENT_ID } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { navigationWidth } from '@/test-support/navigation-width'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import TasksPage from './TasksPage'

const base = `/api/organizations/${COUNCIL_ID}/tasks`
const listPath = (status: string, event = 'none') =>
  `${base}?view=all&status=${status}&event=${event}`
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
const OPEN = [
  task('a'),
  task('b', { actions: [] }),
  task('c', { status: 'in_progress', next: 'done' }),
]
const DONE = [task('d', { status: 'done', next: 'todo' })]

let api: ReturnType<typeof mockApi>
function serve(
  event = 'none',
  done: { tasks: TaskSummary[]; truncated: boolean } = {
    tasks: DONE,
    truncated: false,
  },
) {
  api = mockApi()
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(teamResponse()))
  const options = json({ departments: [], linkableEvents: [] })
  api.on('GET', `${base}/options`, () => options.clone())
  api.on('GET', `${base}/options?event=${EVENT_ID}`, () => options.clone())
  api.on('GET', listPath('open', event), () => json({ tasks: OPEN, truncated: false }))
  api.on('GET', listPath('done', event), () => json(done))
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
const statusTabs = () => screen.findByRole('tablist', { name: '업무 상태' })
const rowTitles = () =>
  screen.queryAllByRole('listitem').map(item => within(item).getAllByRole('button')[0]?.textContent)

let resize: (width: number) => void
beforeEach(() => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  window.localStorage.clear()
  resize = navigationWidth(1023)
})
afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

test('1024 아래에서는 상태 탭 셋이 할 일부터 그 상태의 줄만 보이고 탭 수와 줄 수가 같다', async () => {
  serve()
  render(page())
  const tabs = await statusTabs()
  await waitFor(() =>
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map(tab => tab.textContent),
    ).toEqual(['할 일 2', '진행 중 1', '끝남 1']),
  )
  expect(within(tabs).getByRole('tab', { name: '할 일 2' }).getAttribute('aria-selected')).toBe(
    'true',
  )
  expect(rowTitles()).toEqual(['업무 a', '업무 b'])
  // 같은 줄 목록을 그리던 [보드]·[표]와 끝남 거르기는 휴대폰에 없다(헛단추).
  expect(screen.queryByRole('group', { name: '보기 모양' })).toBeNull()
  expect(screen.queryByRole('group', { name: '업무 거르기' })).toBeNull()
  expect(screen.queryByRole('region', { name: /^할 일/ })).toBeNull()
})

test('탭을 바꾸면 주소에 남고 다시 열어도 같은 탭이다', async () => {
  serve()
  const { unmount } = render(page())
  fireEvent.click(await screen.findByRole('tab', { name: '진행 중 1' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?col=in_progress`))
  expect(rowTitles()).toEqual(['업무 c'])
  fireEvent.click(screen.getByRole('tab', { name: '끝남 1' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?col=done`))
  expect(rowTitles()).toEqual(['업무 d'])
  unmount()
  render(page())
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: '끝남 1' }).getAttribute('aria-selected')).toBe('true'),
  )
  fireEvent.click(screen.getByRole('tab', { name: '할 일 2' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}`))
})

test('행사 업무 탭도 같은 상태 탭과 주소 키를 쓴다', async () => {
  window.history.replaceState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks`)
  serve(EVENT_ID)
  render(page(EVENT_ID))
  fireEvent.click(await screen.findByRole('tab', { name: '진행 중 1' }))
  await waitFor(() =>
    expect(pathNow()).toBe(`/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks&col=in_progress`),
  )
  // 행사 안의 달력은 남고 같은 줄 목록이던 [표]만 빠진다.
  const layouts = screen.getByRole('group', { name: '보기 모양' })
  expect(
    within(layouts)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['보드', '달력'])
})

test('상태 단추는 그 업무 actions에 상태 바꾸기가 있을 때만 있고 누르면 지금 요청을 보낸다', async () => {
  serve()
  api.on('POST', `${base}/a/status`, () => json({ ok: true }))
  render(page())
  await screen.findByRole('tab', { name: '할 일 2' })
  await waitFor(() => expect(rowTitles()).toEqual(['업무 a', '업무 b']))
  const [first, second] = screen.getAllByRole('listitem')
  expect(within(second!).queryByRole('button', { name: '시작' })).toBeNull()
  fireEvent.click(within(first!).getByRole('button', { name: '시작' }))
  await waitFor(() =>
    expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ status: 'in_progress' }),
  )
})

test('끝남이 상한에서 잘렸으면 탭 수 뒤에 +다', async () => {
  serve('none', { tasks: DONE, truncated: true })
  render(page())
  expect(await screen.findByRole('tab', { name: '끝남 1+' })).toBeTruthy()
})

test('1024 이상에서는 지금 3열 보드이고 상태 탭이 없다', async () => {
  serve()
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({ events: [], truncated: false }),
  )
  resize(1024)
  render(page())
  expect(await screen.findByRole('region', { name: /^할 일/ })).toBeTruthy()
  expect(screen.queryByRole('tablist', { name: '업무 상태' })).toBeNull()
})
