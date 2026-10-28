// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { TASK_LOST } from '@/lib/messages'
import { settle } from '@/test-support/settle'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { useHere } from '@/lib/app-location'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import TasksPage from './TasksPage'
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'

afterEach(async () => {
  cleanup()
  // 만든 뒤 여는 업무 주소가 닫힌 창의 기록 이동(history.go) 뒤에 쓰이므로, 그 이동이 끝난 뒤 다음 시험을 시작한다.
  await windowHistoryIdle()
  resetWindowHistory()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const BASE = `/api/organizations/${COUNCIL_ID}/tasks`
const LIST = `${BASE}?view=all&status=open&event=none`
const summary: TaskSummary = {
  id: T1,
  title: '현수막 주문',
  status: 'todo',
  next: 'in_progress',
  dueDate: null,
  overdue: false,
  department: null,
  event: null,
  assignee: null,
  actions: ['task.change_status', 'task.edit'],
}

// 작업 공간이 하는 일 하나: 주소가 업무 기록이면 그 업무를 열고 시작하는 새 페이지로 그린다.
function Page(props: Parameters<typeof TasksPage>[0]) {
  const here = useHere()
  const record = here.location?.type === 'record' ? here.location : null
  return (
    <TasksPage
      key={record || here.released ? here.key : ''}
      {...props}
      initialTaskId={record?.recordId}
    />
  )
}

function setup() {
  const api = mockApi()
  api.on('GET', LIST, () => json({ tasks: [summary], truncated: false }))
  api.on('GET', `${BASE}/${T1}`, () => json({ task: taskDetail({ id: T1 }) }))
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(teamResponse()))
  api.on('GET', `${BASE}/options`, () =>
    json({
      departments: [{ id: null, name: null, assignees: [{ id: null, name: null }] }],
      linkableEvents: [],
    }),
  )
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({ events: [], truncated: false }),
  )
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(<Page view={councilView(COUNCIL_ID)} {...handlers} />)
  const reads = () => api.calls.filter(call => call.path === LIST).length
  return { api, handlers, reads }
}

test('카드 제목을 누르면 상세가 열리고, 상태를 바꾸면 목록과 수를 다시 읽는다', async () => {
  const { api, handlers, reads } = setup()
  api.on('POST', `${BASE}/${T1}/status`, () =>
    json({ task: taskDetail({ id: T1, status: 'in_progress' }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const dialog = await screen.findByRole('dialog')
  await screen.findByText('크기는 3m로 해 주세요.')
  const before = reads()
  fireEvent.click(await screen.findByRole('button', { name: '진행 중' }))
  await waitFor(() => expect(handlers.onChanged).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
  expect(dialog.isConnected).toBe(true)
})

test('빠른 추가로 만들면 목록과 수를 다시 읽는다', async () => {
  const { api, handlers, reads } = setup()
  api.on('POST', BASE, () => json({ task: taskDetail({ id: T1 }) }, 201))
  await screen.findByRole('button', { name: '현수막 주문' })
  const input = screen.getByRole('textbox', { name: '새 업무' })
  await settle()
  const before = reads()
  fireEvent.change(input, { target: { value: '청소' } })
  fireEvent.click(screen.getByRole('button', { name: '추가' }))
  await waitFor(() => expect(handlers.onChanged).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
})

test('머리에서 제목만으로 만들면 목록·수를 다시 읽고 추가 창 대신 새 업무 패널을 연다', async () => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  const { api, handlers, reads } = setup()
  api.on('POST', BASE, () => json({ task: taskDetail({ id: T1 }) }, 201))
  fireEvent.click(await screen.findByRole('button', { name: '업무 추가' }))
  const dialog = await screen.findByRole('dialog', { name: '업무 추가' })
  for (const name of ['업무 정의', '담당·일정', '연결 맥락'])
    expect(within(dialog).getByRole('region', { name })).toBeTruthy()
  expect(within(dialog).getByRole<HTMLSelectElement>('combobox', { name: /^행사/ }).value).toBe('')
  fireEvent.change(within(dialog).getByRole('textbox', { name: /^제목/ }), {
    target: { value: '현수막 주문' },
  })
  const before = reads()
  fireEvent.click(within(dialog).getByRole('button', { name: '업무 추가' }))
  await waitFor(() => expect(handlers.onChanged).toHaveBeenCalledOnce())
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
  await waitFor(() => expect(window.location.pathname).toBe(`/tasks/${COUNCIL_ID}/${T1}`))
  await screen.findByText('크기는 3m로 해 주세요.')
  expect(screen.queryByRole('dialog', { name: '업무 추가' })).toBeNull()
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    title: '현수막 주문',
    body: null,
    dueDate: null,
    departmentId: null,
    assigneeId: null,
    eventId: null,
  })
})

test('바꾸는 중 업무가 지워지면(404) 대화상자를 닫고 이유를 만들기 옆에 보인다', async () => {
  const { api } = setup()
  api.on('POST', `${BASE}/${T1}/status`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  fireEvent.click(await screen.findByRole('button', { name: '끝남' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(TASK_LOST)
})

test('바꾸는 중 권한을 잃으면(403) 학생회를 다시 읽게 하고 이유를 보인다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${BASE}/${T1}/status`, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  fireEvent.click(await screen.findByRole('button', { name: '끝남' }))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/권한이 바뀌었어요/)
})

// 목록의 줄(상세 패널 머리의 같은 이름 단추는 뺀다).
const listRows = (dialog: HTMLElement) =>
  screen
    .queryAllByRole('button', { name: '현수막 주문', hidden: true })
    .filter(button => !dialog.contains(button))

test('행사 없는 업무를 행사로 옮기면 상세를 유지하며 이동 안내와 행사 보기·되돌리기를 보인다', async () => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  const { api } = setup()
  let current = taskDetail({ id: T1 })
  api.on('GET', LIST, () => json({ tasks: current.event ? [] : [summary], truncated: false }))
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({ events: [eventSummary()], truncated: false }),
  )
  api.on('GET', `${BASE}/options`, () =>
    json({
      departments: [],
      linkableEvents: [{ departmentId: 'd1', eventIds: [EVENT_ID] }],
    }),
  )
  api.on('POST', `${BASE}/${T1}`, ({ body }) => {
    const eventId = (body as { eventId: string | null }).eventId
    current = taskDetail({
      id: T1,
      event: eventId ? { id: EVENT_ID, name: '신입생 환영회' } : null,
    })
    return json({ task: current })
  })
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(await within(dialog).findByRole('button', { name: '행사 행사 없음' }))
  fireEvent.click(await screen.findByRole('option', { name: '신입생 환영회' }))
  expect(await screen.findByText('신입생 환영회 행사로 옮겼어요')).toBeTruthy()
  expect(dialog.isConnected).toBe(true)
  expect(screen.getByRole('button', { name: '행사에서 보기', hidden: true })).toBeTruthy()
  await waitFor(() => expect(listRows(dialog)).toHaveLength(0))
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
  await waitFor(() => expect(screen.queryByText('신입생 환영회 행사로 옮겼어요')).toBeNull())
  expect(dialog.isConnected).toBe(true)
  expect(await within(dialog).findByRole('button', { name: '행사 행사 없음' })).toBeTruthy()
  await waitFor(() => expect(listRows(dialog)).toHaveLength(1))
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([
    expect.objectContaining({ eventId: EVENT_ID }),
    { eventId: null },
  ])
})
