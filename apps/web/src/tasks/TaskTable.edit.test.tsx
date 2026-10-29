// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { resetLeaveGuard, hasUnsavedInput } from '@/lib/leave-guard'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import TasksPage from './TasksPage'

const base = `/api/organizations/${COUNCIL_ID}/tasks`
const listPath = (view: string) =>
  `${base}?view=${view}&status=open${view === 'all' ? '&event=none' : ''}`
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

function wide(matches = true) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function serve(tasks: () => TaskSummary[]) {
  const api = mockApi()
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(teamResponse()))
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({ events: [eventSummary({ id: 'e1' })], truncated: false }),
  )
  api.on('GET', listPath('mine'), () => json({ tasks: [], truncated: false }))
  api.on('GET', listPath('all'), () => json({ tasks: tasks(), truncated: false }))
  return api
}

// 넓은 화면의 기본은 보드라(DEC-94) 표는 주소의 배치 값(layout=list)으로 연다.
async function showAll() {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}?layout=list`)
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  fireEvent.click(await screen.findByRole('tab', { name: '학생회 업무' }))
}

afterEach(() => {
  cleanup()
  resetLeaveGuard()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const cell = (id: string, col: number) =>
  document.querySelector<HTMLElement>(`[role="gridcell"][data-row="${id}"][data-col="${col}"]`)!
const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key })
const posts = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(call => call.method === 'POST').map(call => call.body)
const status = () => screen.getByRole('status')

test('제목은 연필 단추로 글 칸이 되고 Enter에 제목 키 하나만 보낸다', async () => {
  wide()
  let current = task('a')
  const api = serve(() => [current])
  api.on('POST', `${base}/a`, () => {
    current = task('a', { title: '새 제목' })
    return json({ task: current })
  })
  await showAll()
  fireEvent.click(await screen.findByRole('button', { name: '업무 a 제목 고치기' }))
  const input = screen.getByRole('textbox', { name: '업무 a 제목' })
  expect(document.activeElement).toBe(input)
  fireEvent.change(input, { target: { value: '새 제목' } })
  expect(hasUnsavedInput()).toBe(true)
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(screen.queryByRole('textbox', { name: '업무 a 제목' })).toBeNull())
  expect(posts(api)).toEqual([{ title: '새 제목' }])
  expect(api.calls.some(call => call.method === 'GET' && call.path === `${base}/a`)).toBe(false)
  expect(await screen.findByRole('button', { name: '새 제목' })).toBeTruthy()
  expect(hasUnsavedInput()).toBe(false)
  expect(document.activeElement).toBe(cell('a', 0))
})

test('Escape는 원래 제목으로 돌아오고, 같은 값은 요청이 없다', async () => {
  wide()
  const api = serve(() => [task('a')])
  await showAll()
  await screen.findByRole('grid')
  cell('a', 0).focus()
  press('F2')
  let input = screen.getByRole('textbox', { name: '업무 a 제목' })
  fireEvent.change(input, { target: { value: '고치다 만 글' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(screen.queryByRole('textbox', { name: '업무 a 제목' })).toBeNull()
  expect(screen.getByRole('button', { name: '업무 a' })).toBeTruthy()
  expect(document.activeElement).toBe(cell('a', 0))
  press('F2')
  input = screen.getByRole('textbox', { name: '업무 a 제목' })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(screen.queryByRole('textbox', { name: '업무 a 제목' })).toBeNull())
  expect(posts(api)).toEqual([])
})

test('빈 제목과 101자는 줄 아래 문구이고 고치기가 이어진다. 칸을 떠나면 보낸다', async () => {
  wide()
  const api = serve(() => [task('a')])
  api.on('POST', `${base}/a`, () => json({ task: task('a', { title: '떠나며 저장' }) }))
  await showAll()
  fireEvent.click(await screen.findByRole('button', { name: '업무 a 제목 고치기' }))
  const input = screen.getByRole('textbox', { name: '업무 a 제목' })
  fireEvent.change(input, { target: { value: '  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect((await screen.findByRole('alert')).textContent).toBe('제목을 입력해 주세요')
  fireEvent.change(input, { target: { value: '😀'.repeat(101) } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('더 짧게 입력해 주세요'))
  expect(screen.getByRole('textbox', { name: '업무 a 제목' })).toBeTruthy()
  expect(posts(api)).toEqual([])
  fireEvent.change(input, { target: { value: '떠나며 저장' } })
  fireEvent.blur(input)
  await waitFor(() => expect(posts(api)).toEqual([{ title: '떠나며 저장' }]))
  await waitFor(() => expect(screen.queryByRole('textbox', { name: '업무 a 제목' })).toBeNull())
})

test('서버가 막으면 줄 아래 문구이고 글 칸에 고치던 글이 남는다', async () => {
  wide()
  const api = serve(() => [task('a')])
  api.on('POST', `${base}/a`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  await showAll()
  fireEvent.click(await screen.findByRole('button', { name: '업무 a 제목 고치기' }))
  const input = screen.getByRole('textbox', { name: '업무 a 제목' })
  fireEvent.change(input, { target: { value: '다시 시도할 글' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect((await screen.findByRole('alert')).textContent).toContain('너무 빨리')
  const kept = screen.getByRole('textbox', { name: '업무 a 제목' }) as HTMLInputElement
  expect(kept.value).toBe('다시 시도할 글')
})

test('task.edit가 없으면 제목·마감에 고치기 단추가 없다', async () => {
  wide()
  serve(() => [task('a', { actions: ['task.change_status'] })])
  await showAll()
  await screen.findByRole('grid')
  expect(screen.queryByRole('button', { name: '업무 a 제목 고치기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '업무 a 마감 고치기' })).toBeNull()
  cell('a', 3).focus()
  press('Enter')
  expect(screen.queryByLabelText('업무 a 마감')).toBeNull()
})

test('마감은 앱 달력 창으로 고치고 마감 없음이면 비운다. 보내는 것은 마감 키 하나이고 닫히면 칸으로 돌아온다', async () => {
  wide()
  let current = task('a')
  const api = serve(() => [current])
  api.on('POST', `${base}/a`, () => {
    current = task('a', { dueDate: null })
    return json({ task: current })
  })
  await showAll()
  await screen.findByRole('grid')
  cell('a', 3).focus()
  press('Enter')
  const picker = await screen.findByRole('dialog', { name: '업무 a 마감' })
  await waitFor(() =>
    expect(document.activeElement).toBe(
      within(picker).getByRole('button', { name: '10월 25일 (일)' }),
    ),
  )
  fireEvent.click(within(picker).getByRole('button', { name: '마감 없음' }))
  await waitFor(() => expect(posts(api)).toEqual([{ dueDate: null }]))
  await waitFor(() => expect(document.activeElement).toBe(cell('a', 3)))
  expect(cell('a', 3).textContent).toBe('마감 없음')
})

test('담당자를 바꾸면 띠가 뜨고 되돌리기는 이전 담당자로 맡기고 띠를 닫는다', async () => {
  wide()
  const api = serve(() => [task('a')])
  api.on('POST', `${base}/a/assignee`, () =>
    json({ task: task('a', { assignee: { id: 'm3', name: '박새내', current: true } }) }),
  )
  await showAll()
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 담당자' }), {
    target: { value: 'm3' },
  })
  await waitFor(() => expect(status().textContent).toContain('담당자 변경: 박새내'))
  fireEvent.click(within(status()).getByRole('button', { name: '되돌리기' }))
  await waitFor(() => expect(posts(api)).toEqual([{ assigneeId: 'm3' }, { assigneeId: 'm2' }]))
  await waitFor(() => expect(status().textContent).toBe(''))
})

test('비우면 담당자 없음이고, 닫기로 닫힌다', async () => {
  wide()
  const api = serve(() => [task('a')])
  api.on('POST', `${base}/a/assignee`, () => json({ task: task('a', { assignee: null }) }))
  await showAll()
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 담당자' }), {
    target: { value: '' },
  })
  await waitFor(() => expect(status().textContent).toContain('담당자 변경: 담당자 없음'))
  fireEvent.click(within(status()).getByRole('button', { name: '닫기' }))
  expect(status().textContent).toBe('')
})

test('되돌리기가 409면 띠 안의 문구이고 띠는 남는다', async () => {
  wide()
  const api = serve(() => [task('a')])
  let calls = 0
  api.on('POST', `${base}/a/assignee`, () => {
    calls += 1
    return calls === 1
      ? json({ task: task('a', { assignee: { id: 'm3', name: '박새내', current: true } }) })
      : json({ error: 'TASK_ASSIGNEE_INVALID' }, 409)
  })
  await showAll()
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 담당자' }), {
    target: { value: 'm3' },
  })
  await waitFor(() => expect(status().textContent).toContain('박새내'))
  fireEvent.click(within(status()).getByRole('button', { name: '되돌리기' }))
  await waitFor(() => expect(status().textContent).toContain('지금은 운영진이 아니에요'))
  expect(within(status()).getByRole('button', { name: '되돌리기' })).toBeTruthy()
})

test('휴대폰 줄에서 담당자를 지정해도 띠가 뜬다', async () => {
  wide(false)
  const api = serve(() => [task('a', { assignee: null })])
  api.on('POST', `${base}/a/assignee`, () =>
    json({ task: task('a', { assignee: { id: 'm3', name: '박새내', current: true } }) }),
  )
  await showAll()
  fireEvent.change(await screen.findByRole('combobox', { name: '업무 a 담당자' }), {
    target: { value: 'm3' },
  })
  await waitFor(() => expect(status().textContent).toContain('담당자 변경: 박새내'))
})

test('표에서 행사로 옮기면 이동 안내에서 되돌리거나 행사의 업무 탭으로 간다', async () => {
  wide()
  let current = task('a')
  const api = serve(() => (current.event ? [] : [current]))
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({ events: [eventSummary()], truncated: false }),
  )
  api.on('GET', `${base}/options`, () =>
    json({ departments: [], linkableEvents: [{ departmentId: 'd1', eventIds: [EVENT_ID] }] }),
  )
  api.on('GET', `${base}?view=all&status=done&event=none`, () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('POST', `${base}/a`, ({ body }) => {
    current = task('a', {
      event: (body as { eventId: string | null }).eventId
        ? { id: EVENT_ID, name: '신입생 환영회' }
        : null,
    })
    return json({ task: current })
  })
  await showAll()
  const move = async () => {
    const select = await screen.findByRole('combobox', { name: '업무 a 행사' })
    await waitFor(() => expect(select).toHaveProperty('disabled', false))
    fireEvent.change(select, { target: { value: EVENT_ID } })
    await screen.findByText('신입생 환영회 행사로 옮겼어요')
  }
  await move()
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
  await screen.findByRole('combobox', { name: '업무 a 행사' })
  expect(posts(api)).toEqual([{ eventId: EVENT_ID }, { eventId: null }])
  await move()
  fireEvent.click(screen.getByRole('button', { name: '행사에서 보기' }))
  await waitFor(() =>
    expect(window.location.pathname + window.location.search).toBe(
      `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks`,
    ),
  )
})
