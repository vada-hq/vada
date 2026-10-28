// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { PUSH_ARRIVED_EVENT } from '@/lib/service-worker'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import TasksPage from './TasksPage'

const base = `/api/organizations/${COUNCIL_ID}/tasks`
const listPath = (view: string, status = 'open') =>
  `${base}?view=${view}&status=${status}${view === 'all' ? '&event=none' : ''}`
const ALL = ['task.change_status', 'task.change_assignee', 'task.change_department', 'task.edit']

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
  actions: ALL as TaskSummary['actions'],
  ...extra,
})
const list = (tasks: TaskSummary[]) => json({ tasks, truncated: false })

function wide(matches = true) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

// 재정부(d1) 업무는 e1에, 학생회 업무는 e1·e2에 이을 수 있다.
function serve(tasks: () => TaskSummary[]) {
  const api = mockApi()
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(teamResponse()))
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({
      events: [eventSummary({ id: 'e1' }), eventSummary({ id: 'e2', name: '체육대회' })],
      truncated: false,
    }),
  )
  api.on('GET', `${base}/options`, () =>
    json({
      departments: [],
      linkableEvents: [
        { departmentId: 'd1', eventIds: ['e1'] },
        { departmentId: null, eventIds: ['e1', 'e2'] },
      ],
    }),
  )
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('all'), () => list(tasks()))
  return api
}

const page = (eventId?: string, onForbidden = () => {}) => (
  <TasksPage
    view={councilView(COUNCIL_ID)}
    eventId={eventId}
    onForbidden={onForbidden}
    onChanged={() => {}}
  />
)

// 업무 화면은 내 업무로 열려 전체 탭으로 간다. 행사의 업무 탭은 처음부터 전체다.
// 넓은 화면의 기본은 보드라(DEC-94) 표는 주소의 배치 값(layout=list)으로 연다.
async function showAll(eventId?: string, onForbidden = () => {}) {
  if (window.location.pathname === '/')
    window.history.replaceState(
      null,
      '',
      eventId
        ? `/events/${COUNCIL_ID}/${eventId}?tab=tasks&layout=list`
        : `/tasks/${COUNCIL_ID}?layout=list`,
    )
  render(page(eventId, onForbidden))
  if (!eventId) fireEvent.click(await screen.findByRole('tab', { name: '학생회 업무' }))
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const cell = (id: string, col: number) =>
  document.querySelector<HTMLElement>(`[role="gridcell"][data-row="${id}"][data-col="${col}"]`)!
const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement!, { key, ...init })

test('넓은 화면은 표(열 제목 여섯)이고 좁은 화면은 지금의 줄이다. 행사의 업무 탭은 행사 열이 없다', async () => {
  wide(false)
  serve(() => [task('a')])
  const narrow = render(page())
  fireEvent.click(await screen.findByRole('tab', { name: '학생회 업무' }))
  await screen.findByRole('button', { name: '업무 a' })
  expect(screen.queryByRole('grid')).toBeNull()
  narrow.unmount()
  window.history.replaceState(null, '', '/')
  wide()
  await showAll()
  await screen.findByRole('grid', { name: '업무 표' })
  expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual([
    '제목',
    '상태',
    '담당자',
    '마감',
    '부서',
    '행사',
  ])
  cleanup()
  window.history.replaceState(null, '', '/')
  const api = serve(() => [])
  api.on('GET', `${base}?view=all&status=open&event=${EVENT_ID}`, () => list([task('a')]))
  await showAll(EVENT_ID)
  await screen.findByRole('grid')
  expect(screen.queryByRole('columnheader', { name: '행사' })).toBeNull()
})

test('actions에 있는 칸만 고르는 칸이고 나머지는 글자라 aria-readonly다', async () => {
  wide()
  serve(() => [task('a', { actions: ['task.change_status'] })])
  await showAll()
  await screen.findByRole('grid')
  expect(within(cell('a', 1)).getByRole('combobox', { name: '업무 a 상태' })).toBeTruthy()
  expect(cell('a', 1).getAttribute('aria-readonly')).toBeNull()
  for (const col of [0, 2, 3, 4, 5]) {
    expect(cell('a', col).getAttribute('aria-readonly')).toBe('true')
    expect(within(cell('a', col)).queryByRole('combobox')).toBeNull()
  }
})

test('담당자를 고르면 바로 그 담당자만 보내고, 응답으로 줄을 바꾼 뒤 목록을 다시 읽는다', async () => {
  wide()
  let reads = 0
  const api = serve(() => {
    reads += 1
    return [task('a')]
  })
  api.on('POST', `${base}/a/assignee`, () =>
    json({ task: task('a', { assignee: { id: 'm3', name: '박새내', current: true } }) }),
  )
  await showAll()
  const select = await screen.findByRole('combobox', { name: '업무 a 담당자' })
  const before = reads
  fireEvent.change(select, { target: { value: 'm3' } })
  await waitFor(() => expect((select as HTMLSelectElement).value).toBe('m3'))
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([
    { assigneeId: 'm3' },
  ])
  await waitFor(() => expect(reads).toBeGreaterThan(before))
})

test('같은 값을 다시 고르면 요청이 없고, 보내는 동안 그 칸은 값을 바꾸지 않는다', async () => {
  wide()
  let release!: (response: Response) => void
  const api = serve(() => [task('a')])
  api.on('POST', `${base}/a/status`, () => new Promise<Response>(resolve => (release = resolve)))
  await showAll()
  const select = (await screen.findByRole('combobox', { name: '업무 a 상태' })) as HTMLSelectElement
  fireEvent.change(select, { target: { value: 'todo' } })
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  fireEvent.change(select, { target: { value: 'in_progress' } })
  await waitFor(() => expect(select.getAttribute('aria-busy')).toBe('true'))
  // 미리 바꿔 보이지 않는다.
  expect(select.value).toBe('todo')
  fireEvent.change(select, { target: { value: 'done' } })
  release(json({ task: task('a', { status: 'in_progress' }) }))
  await waitFor(() => expect(select.value).toBe('in_progress'))
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('떠난 담당자는 떠난 사람으로 보이고 다른 사람을 고르면 바뀐다', async () => {
  wide()
  const api = serve(() => [task('a', { assignee: { id: 'x9', name: '박떠남', current: false } })])
  api.on('POST', `${base}/a/assignee`, () => json({ task: task('a') }))
  await showAll()
  const select = (await screen.findByRole('combobox', {
    name: '업무 a 담당자',
  })) as HTMLSelectElement
  expect(select.value).toBe('x9')
  expect(within(select).getByRole('option', { name: '떠난 사람: 박떠남' })).toBeTruthy()
  fireEvent.change(select, { target: { value: 'm1' } })
  await waitFor(() => expect(api.calls.some(call => call.method === 'POST')).toBe(true))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ assigneeId: 'm1' })
})

test('부서는 부서 경로로, 행사는 행사 키 하나만 보낸다', async () => {
  wide()
  const api = serve(() => [task('a')])
  api.on('POST', `${base}/a/department`, () => json({ task: task('a') }))
  api.on('GET', `${base}/a`, () =>
    json({
      task: {
        ...task('a'),
        body: '본문',
        createdBy: null,
        createdAt: '',
        results: [],
        canMake: [],
        history: [],
      },
    }),
  )
  api.on('POST', `${base}/a`, () =>
    json({ task: task('a', { event: { id: 'e1', name: '신입생 환영회' } }) }),
  )
  await showAll()
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 부서' }), {
    target: { value: 'd2' },
  })
  await waitFor(() =>
    expect(api.calls.find(call => call.path === `${base}/a/department`)?.body).toEqual({
      departmentId: 'd2',
    }),
  )
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 행사' }), {
    target: { value: 'e1' },
  })
  await waitFor(() =>
    expect(
      api.calls.find(call => call.method === 'POST' && call.path === `${base}/a`)?.body,
    ).toEqual({ eventId: 'e1' }),
  )
})

test('표의 행사 칸에는 그 업무 부서로 이을 수 있는 행사만 있다', async () => {
  wide()
  serve(() => [task('a'), task('b', { department: null })])
  await showAll()
  const options = async (name: string) =>
    within(await screen.findByRole('combobox', { name }))
      .getAllByRole('option')
      .map(option => option.textContent)
  expect(await options('업무 a 행사')).toEqual(['행사 없음', '신입생 환영회'])
  expect(await options('업무 b 행사')).toEqual(['행사 없음', '신입생 환영회', '체육대회'])
})

test('실패는 그 줄 아래 한 줄이고, 계속 쓸 수 있다', async () => {
  wide()
  const api = serve(() => [task('a'), task('b')])
  api.on('POST', `${base}/a/assignee`, () => json({ error: 'TASK_ASSIGNEE_INVALID' }, 409))
  api.on('POST', `${base}/b/status`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  await showAll()
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 담당자' }), {
    target: { value: 'm3' },
  })
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('지금 운영진만')
  expect(alert.closest('tr')?.previousElementSibling?.contains(cell('a', 0))).toBe(true)
  fireEvent.change(screen.getByRole('combobox', { name: '업무 b 상태' }), {
    target: { value: 'done' },
  })
  expect(await screen.findByText(/너무 빨리 바꾸고 있어요/)).toBeTruthy()
})

test('Tab 한 번으로 들어가 마지막 칸에 서고, 화살표·Home·End·Ctrl+Home/End로 움직인다', async () => {
  wide()
  serve(() => [task('a'), task('b')])
  await showAll()
  await screen.findByRole('grid')
  const tabbable = document.querySelectorAll('[role="grid"] [tabindex="0"]')
  expect(tabbable).toHaveLength(1)
  expect(tabbable[0]).toBe(cell('a', 0))
  cell('a', 0).focus()
  press('ArrowRight')
  expect(document.activeElement).toBe(cell('a', 1))
  press('ArrowDown')
  expect(document.activeElement).toBe(cell('b', 1))
  press('ArrowDown')
  expect(document.activeElement).toBe(cell('b', 1))
  press('End')
  expect(document.activeElement).toBe(cell('b', 5))
  press('ArrowRight')
  expect(document.activeElement).toBe(cell('b', 5))
  press('Home')
  expect(document.activeElement).toBe(cell('b', 0))
  press('End', { ctrlKey: true })
  expect(document.activeElement).toBe(cell('b', 5))
  press('Home', { ctrlKey: true })
  expect(document.activeElement).toBe(cell('a', 0))
  // 마지막에 있던 칸이 다음에 들어올 칸이다.
  press('ArrowDown')
  expect(document.querySelector('[role="grid"] [tabindex="0"]')).toBe(cell('b', 0))
})

test('Enter는 제목 칸이면 상세를, 고르는 칸이면 고치기를 열고, F2·Escape로 들어가고 나온다', async () => {
  wide()
  serve(() => [task('a', { actions: ['task.change_status'] })])
  await showAll()
  await screen.findByRole('grid')
  cell('a', 1).focus()
  press('Enter')
  const select = screen.getByRole('combobox', { name: '업무 a 상태' })
  expect(document.activeElement).toBe(select)
  press('Escape')
  expect(document.activeElement).toBe(cell('a', 1))
  press('F2')
  expect(document.activeElement).toBe(select)
  press('F2')
  expect(document.activeElement).toBe(cell('a', 1))
  // 고칠 수 없는 칸에서는 아무 일도 없다(담당자 칸은 이름의 1:1 단추로 들어간다).
  cell('a', 4).focus()
  press('Enter')
  expect(document.activeElement).toBe(cell('a', 4))
  cell('a', 2).focus()
  press('Enter')
  expect(document.activeElement).toBe(within(cell('a', 2)).getByRole('button'))
  // 제목 칸의 Enter는 상세다(주소가 업무로 바뀐다).
  cell('a', 0).focus()
  press('Enter')
  expect(window.location.pathname).toBe(`/tasks/${COUNCIL_ID}/a`)
})

test('다시 읽어 줄이 다른 묶음으로 옮겨도 초점은 같은 업무의 같은 칸이고, 빠지면 다음 줄의 같은 칸이다', async () => {
  wide()
  let step = 0
  const api = serve(() => {
    if (step === 0)
      return [
        task('a', { department: { id: 'd1', name: '재정부' } }),
        task('b', { department: { id: 'd1', name: '재정부' } }),
        task('c', { department: { id: 'd2', name: '기획부' } }),
      ]
    if (step === 1)
      return [
        task('b'),
        task('a', { department: { id: 'd2', name: '기획부' } }),
        task('c', { department: { id: 'd2', name: '기획부' } }),
      ]
    return [
      task('a', { department: { id: 'd2', name: '기획부' } }),
      task('c', { department: { id: 'd2', name: '기획부' } }),
    ]
  })
  expect(api).toBeTruthy()
  await showAll()
  await screen.findByRole('grid')
  cell('b', 2).focus()
  step = 1
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  await waitFor(() =>
    expect(document.querySelectorAll('tbody tr')[0]?.textContent).toContain('기획부'),
  )
  expect(document.activeElement).toBe(cell('b', 2))
  step = 2
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  await waitFor(() => expect(document.querySelector('[data-row="b"]')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(cell('c', 2)))
})

test('부서 거르기 보기에서도 고른 값이 옛 값으로 돌아가지 않는다', async () => {
  wide()
  let release!: (response: Response) => void
  let saved = false
  const api = serve(() => [task('a')])
  api.on('GET', `${base}?view=all&status=open&event=none`, () =>
    list([task('a', saved ? { status: 'in_progress' } : {})]),
  )
  api.on('POST', `${base}/a/status`, () => {
    saved = true
    return new Promise<Response>(resolve => (release = resolve))
  })
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}?view=all&layout=list`)
  await showAll()
  const select = (await screen.findByRole('combobox', { name: '업무 a 상태' })) as HTMLSelectElement
  fireEvent.change(select, { target: { value: 'in_progress' } })
  await waitFor(() => expect(select.getAttribute('aria-busy')).toBe('true'))
  // 응답이 오면 그 값이고, 그 뒤 목록을 다시 읽어 와도 렌더마다 지우지 않아 값이 그대로다.
  release(json({ task: task('a', { status: 'in_progress' }) }))
  await waitFor(() => expect(select.value).toBe('in_progress'))
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(select.value).toBe('in_progress')
})

test('403은 권한을 다시 읽게 하고 줄 아래에 문구를 보인다', async () => {
  wide()
  const forbidden = vi.fn()
  const api = serve(() => [task('a')])
  api.on('POST', `${base}/a/assignee`, () => json({ error: 'FORBIDDEN' }, 403))
  await showAll(undefined, forbidden)
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 담당자' }), {
    target: { value: 'm3' },
  })
  expect((await screen.findByRole('alert')).textContent).toContain('권한')
  expect(forbidden).toHaveBeenCalled()
})

test('404는 줄이 목록에서 빠지고 화면 위에 이유를 보인다', async () => {
  wide()
  let gone = false
  const api = serve(() => (gone ? [] : [task('a')]))
  api.on('POST', `${base}/a/status`, () => {
    gone = true
    return json({ error: 'NOT_FOUND' }, 404)
  })
  await showAll()
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 상태' }), {
    target: { value: 'done' },
  })
  expect(await screen.findByText('이 업무를 볼 수 없어요. 지워졌을 수 있어요.')).toBeTruthy()
  await waitFor(() => expect(document.querySelector('[data-row="a"]')).toBeNull())
})

test('401은 줄 아래 일반 문구이고 권한을 다시 읽게 하지 않는다', async () => {
  wide()
  const forbidden = vi.fn()
  const api = serve(() => [task('a')])
  api.on('POST', `${base}/a/status`, () => json({ error: 'UNAUTHENTICATED' }, 401))
  await showAll(undefined, forbidden)
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 상태' }), {
    target: { value: 'done' },
  })
  expect((await screen.findByRole('alert')).textContent).toContain('상태를 바꾸지 못했어요')
  expect(forbidden).not.toHaveBeenCalled()
})

test('줄이 옮겨 DOM이 다시 꽂히며 blur가 와도 초점은 같은 칸으로 돌아온다', async () => {
  wide()
  let moved = false
  serve(() =>
    moved
      ? [task('b'), task('a', { department: { id: 'd2', name: '기획부' } })]
      : [task('a'), task('b')],
  )
  await showAll()
  await screen.findByRole('grid')
  cell('a', 2).focus()
  // 가는 곳이 없는 blur(다시 꽂힌 칸)로 초점이 body에 있다.
  fireEvent.blur(cell('a', 2))
  cell('a', 2).blur()
  expect(document.activeElement).toBe(document.body)
  moved = true
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  await waitFor(() => expect(document.activeElement).toBe(cell('a', 2)))
})

test('표는 열 너비를 고정하지 않는다: 제목이 남는 폭을 쓰고 나머지는 내용 폭이며, 제목 옆에 상태 칩이 없다', async () => {
  wide()
  serve(() => [task('a', { status: 'in_progress', next: 'done' })])
  await showAll()
  const grid = await screen.findByRole('grid')
  expect(grid.className).not.toContain('table-fixed')
  expect(grid.querySelector('col')).toBeNull()
  expect(cell('a', 0).className).toContain('min-w-40')
  for (const col of [1, 2, 3, 4, 5]) expect(cell('a', col).className).toContain('w-px')
  expect(within(cell('a', 1)).getByRole('combobox').className).toContain('w-auto')
  expect(within(cell('a', 0)).queryByText('진행 중')).toBeNull()
})
