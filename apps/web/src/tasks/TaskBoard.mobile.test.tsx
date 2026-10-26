// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TASK_DONE_LIMIT, type TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { EVENT_ID } from '@/test-support/event-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import TasksPage from './TasksPage'

const base = `/api/organizations/${COUNCIL_ID}/tasks`
const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: `업무 ${id}`,
  status: 'todo',
  next: 'in_progress',
  dueDate: null,
  overdue: false,
  department: null,
  event: null,
  assignee: { id: 'm1', name: '김회장', current: true },
  actions: ['task.change_status'],
  ...extra,
})
let api: ReturnType<typeof mockApi>
const ready = (tasks: TaskSummary[], truncated = false) => json({ tasks, truncated })
const pathNow = () => window.location.pathname + window.location.search

function setup(eventId?: string, councilSpace = false) {
  const view = eventId || councilSpace ? 'all' : 'mine'
  const suffix = eventId ? `&event=${eventId}` : ''
  const listPath = (status: string) => `${base}?view=${view}&status=${status}${suffix}`
  const open = [
    task('a'),
    task('b', { actions: [] }),
    task('c', { status: 'in_progress', next: 'done' }),
  ]
  const done = [task('d', { status: 'done', next: null })]
  api.on('GET', listPath('open'), () => ready(open))
  api.on('GET', listPath('done'), () => ready(done))
  return {
    open,
    done,
    listPath,
    page: () => (
      <TasksPage
        view={councilView(COUNCIL_ID)}
        eventId={eventId}
        councilSpace={councilSpace}
        onChanged={() => {}}
        onForbidden={() => {}}
      />
    ),
  }
}

beforeEach(() => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  api = mockApi()
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/options`, () => json({ departments: [], linkableEvents: [] }))
  api.on('GET', `${base}/options?event=${EVENT_ID}`, () =>
    json({ departments: [], linkableEvents: [] }),
  )
})
afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

const tabs = () => screen.findByRole('tablist', { name: '업무 상태' })

test('좁은 보드는 할 일 탭부터 열고 상태별 카드 수와 일치하며 한 상태만 보인다', async () => {
  const { page } = setup()
  render(page())
  const states = await tabs()
  expect(
    within(states)
      .getAllByRole('tab')
      .map(tab => tab.textContent),
  ).toEqual(['할 일 2', '진행 중 1', '끝남 1'])
  expect(within(states).getByRole('tab', { name: '할 일 2' }).getAttribute('aria-selected')).toBe(
    'true',
  )
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: '업무 c' })).toBeNull()
  expect(screen.queryByRole('group', { name: '업무 거르기' })).toBeNull()
  fireEvent.click(within(states).getByRole('tab', { name: '진행 중 1' }))
  expect(await screen.findByRole('button', { name: '업무 c' })).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: '업무 a' })).toBeNull()
})

test.each(['tasks', 'council', 'events'])(
  '%s에서 상태 탭은 주소를 replace하고 다시 열어도 같다',
  async menu => {
    const event = menu === 'events'
    const council = menu === 'council'
    const path = event
      ? `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks`
      : council
        ? `/council/${COUNCIL_ID}?tab=tasks`
        : `/tasks/${COUNCIL_ID}`
    window.history.replaceState(null, '', path)
    const { page } = setup(event ? EVENT_ID : undefined, council)
    const mounted = render(page())
    const historyLength = window.history.length
    fireEvent.click(within(await tabs()).getByRole('tab', { name: '끝남 1' }))
    await waitFor(() =>
      expect(pathNow()).toBe(`${path}${path.includes('?') ? '&' : '?'}status=done`),
    )
    expect(window.history.length).toBe(historyLength)
    mounted.unmount()
    render(page())
    expect(
      within(await tabs())
        .getByRole('tab', { name: '끝남 1' })
        .getAttribute('aria-selected'),
    ).toBe('true')
    expect(await screen.findByRole('button', { name: '업무 d' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /시작|끝내기/ })).toBeNull()
    fireEvent.click(within(await tabs()).getByRole('tab', { name: '할 일 2' }))
    await waitFor(() => expect(pathNow()).toBe(path))
  },
)

test('시작·끝내기는 권한이 있을 때만 있고 성공 뒤 두 목록을 다시 읽는다', async () => {
  const { page, open, done } = setup()
  const pending = deferredResponse()
  api.on('POST', `${base}/a/status`, () => pending.promise)
  api.on('POST', `${base}/c/status`, () => {
    open.splice(
      open.findIndex(item => item.id === 'c'),
      1,
    )
    done.push(task('c', { status: 'done', next: null }))
    return ready([])
  })
  render(page())
  await tabs()
  const card = screen.getByRole('button', { name: '업무 a' }).closest('li')!
  const start = within(card).getByRole('button', { name: '시작' })
  expect(
    within(screen.getByRole('button', { name: '업무 b' }).closest('li')!).queryByRole('button', {
      name: '시작',
    }),
  ).toBeNull()
  fireEvent.click(start)
  fireEvent.click(start)
  expect((start as HTMLButtonElement).disabled).toBe(true)
  open[0] = task('a', { status: 'in_progress', next: 'done' })
  pending.resolve(ready([]))
  await waitFor(() => expect(screen.queryByRole('button', { name: '업무 a' })).toBeNull())
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([
    { status: 'in_progress' },
  ])
  fireEvent.click(within(await tabs()).getByRole('tab', { name: '진행 중 2' }))
  fireEvent.click(
    within(screen.getByRole('button', { name: '업무 c' }).closest('li')!).getByRole('button', {
      name: '끝내기',
    }),
  )
  await waitFor(() =>
    expect(
      within(screen.getByRole('tablist', { name: '업무 상태' })).getByRole('tab', {
        name: '끝남 2',
      }),
    ).toBeTruthy(),
  )
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([
    { status: 'in_progress' },
    { status: 'done' },
  ])
})

test('실패한 상태 변경은 카드에 오류를 보이고 다시 누를 수 있다', async () => {
  const { page } = setup()
  api.on('POST', `${base}/a/status`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  render(page())
  await tabs()
  fireEvent.click(screen.getByRole('button', { name: '시작' }))
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    '너무 빨리 바꾸고 있어요. 잠시 뒤에 다시 해 주세요.',
  )
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '시작' }).disabled).toBe(false)
})

test('끝남 50+는 50장과 표로 보기를 보이고 표의 끝남으로 간다', async () => {
  const { page, done, listPath } = setup()
  done.splice(
    0,
    done.length,
    ...Array.from({ length: TASK_DONE_LIMIT }, (_, i) =>
      task(`d${i}`, { status: 'done', next: null }),
    ),
  )
  api.on('GET', listPath('done'), () => ready(done, true))
  render(page())
  fireEvent.click(within(await tabs()).getByRole('tab', { name: '끝남 50+' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(TASK_DONE_LIMIT)
  fireEvent.click(screen.getByRole('button', { name: '표로 보기' }))
  await waitFor(() =>
    expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?filter=done&layout=list&status=done`),
  )
  expect(screen.queryByRole('tablist', { name: '업무 상태' })).toBeNull()
})

test('빈 상태 탭은 0이고 카드는 없으며 키보드로 상태를 고른다', async () => {
  const { page, done } = setup()
  done.splice(0)
  render(page())
  const states = await tabs()
  fireEvent.keyDown(within(states).getByRole('tab', { name: '할 일 2' }), { key: 'End' })
  expect(within(states).getByRole('tab', { name: '끝남 0' }).getAttribute('aria-selected')).toBe(
    'true',
  )
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.getByText('끝난 업무 없음')).toBeTruthy()
})

test('읽기 전·실패에는 수를 지어내지 않고 다시 읽은 뒤 상태 수를 보인다', async () => {
  const { page, listPath, done } = setup()
  const pending = deferredResponse()
  let reads = 0
  api.on('GET', listPath('done'), () => (++reads === 1 ? pending.promise : ready(done)))
  render(page())
  expect(screen.getByText('업무 불러오는 중…')).toBeTruthy()
  expect(screen.queryByRole('tablist', { name: '업무 상태' })).toBeNull()
  pending.resolve(json({ error: 'INTERNAL_ERROR' }, 500))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByRole('tablist', { name: '업무 상태' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(within(await tabs()).getByRole('tab', { name: '끝남 1' })).toBeTruthy()
})
