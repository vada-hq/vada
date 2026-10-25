// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskCreateOptionsResponse, TaskSummary } from '@vada/contracts'
import { PERMISSION_CHANGED, TASK_ERRORS } from '@/lib/messages'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { settle } from '@/test-support/settle'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import TasksPage from './TasksPage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const BASE = `/api/organizations/${COUNCIL_ID}/tasks`
const uuid = (tail: string) => `0199d1a0-0000-7000-8000-0000000000${tail}`
const EVENT_ID = uuid('e1')
const D1 = uuid('d1')
const M2 = uuid('a2')
const NONE = { id: null, name: null }
const ME = { id: M2, name: '이재정' }
const memberOptions: TaskCreateOptionsResponse = {
  departments: [
    { id: D1, name: '재정부', assignees: [ME] },
    { id: null, name: null, assignees: [ME] },
  ],
  linkableEvents: [],
}
const leaderOptions: TaskCreateOptionsResponse = {
  departments: [
    { id: D1, name: '재정부', assignees: [NONE, ME] },
    { id: null, name: null, assignees: [NONE, ME] },
  ],
  linkableEvents: [],
}
const member = () => {
  const view = councilView(COUNCIL_ID, {
    councilRank: null,
    permissions: MEMBER_PERMISSIONS,
    memberId: M2,
    departments: [{ id: D1, name: '재정부', role: 'finance', rank: null }],
  })
  return view
}
const made = taskDetail({
  department: { id: D1, name: '재정부' },
  assignee: { id: M2, name: '이재정', current: true },
})
const empty = () => json({ tasks: [] as TaskSummary[], truncated: false })

function setup(options: TaskCreateOptionsResponse | null = memberOptions, view = member()) {
  const api = mockApi()
  for (const tab of ['mine', 'department', 'all', 'unassigned'])
    api.on('GET', `${BASE}?view=${tab}&status=open`, empty)
  api.on('GET', `${BASE}/options`, () => (options ? json(options) : json({ error: 'X' }, 500)))
  api.on('POST', BASE, () => json({ task: made }, 201))
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(<TasksPage view={view} {...handlers} />)
  const posts = () => api.calls.filter(call => call.method === 'POST')
  return { api, handlers, posts }
}

async function add(title: string) {
  const input = await screen.findByRole('textbox', { name: '새 업무' })
  await settle() // 선택지를 다 받은 뒤
  fireEvent.change(input, { target: { value: title } })
  fireEvent.click(screen.getByRole('button', { name: '추가' }))
  return input
}

test('내 업무에서 제목만 쳐 추가하면 내 부서·담당자 나로 만들어지고 칸이 비며 초점이 남는다', async () => {
  const { handlers, posts } = setup()
  const input = await add('청소')
  await waitFor(() => expect(handlers.onChanged).toHaveBeenCalled())
  expect(posts()[0]?.body).toEqual({
    title: '청소',
    body: null,
    dueDate: null,
    departmentId: D1,
    assigneeId: M2,
    eventId: null,
  })
  await waitFor(() => expect((input as HTMLInputElement).value).toBe(''))
  await waitFor(() => expect(document.activeElement).toBe(input))
  expect(screen.queryByText('추가한 업무는 이 보기에 없음')).toBeNull()
})

test('부원이 담당자 없음 탭에서 만들면 나로 만들어져 이 보기에 없음과 [열기]가 보인다', async () => {
  setup()
  fireEvent.click(await screen.findByRole('tab', { name: '담당자 없음' }))
  await add('청소')
  await screen.findByText('추가한 업무는 이 보기에 없음')
  fireEvent.click(screen.getByRole('button', { name: '열기' }))
  await waitFor(() => expect(window.location.pathname).toBe(`/tasks/${COUNCIL_ID}/${made.id}`))
})

test('회장단이 전체 탭에서 만들면 학생회 업무·담당자 없음이다', async () => {
  const { posts } = setup(leaderOptions, councilView(COUNCIL_ID))
  fireEvent.click(await screen.findByRole('tab', { name: '전체' }))
  await add('청소')
  await waitFor(() => expect(posts()).toHaveLength(1))
  expect(posts()[0]?.body).toMatchObject({ departmentId: null, assigneeId: null })
})

test('빈 제목은 칸 아래 오류이고 보내지 않는다', async () => {
  const { posts } = setup()
  await add('  ')
  expect(await screen.findByText('제목을 입력해 주세요')).toBeTruthy()
  expect(posts()).toHaveLength(0)
})

test('보내는 동안 [추가]는 busy이고 두 번 가지 않는다', async () => {
  const { api, posts } = setup()
  const pending = deferredResponse()
  api.on('POST', BASE, () => pending.promise)
  await add('청소')
  const button = screen.getByRole('button', { name: '추가' })
  await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'))
  fireEvent.click(button)
  expect(posts()).toHaveLength(1)
  pending.resolve(json({ task: taskDetail() }, 201))
  await waitFor(() => expect(button.getAttribute('aria-busy')).not.toBe('true'))
})

test.each([
  [409, 'EVENT_INVALID', TASK_ERRORS['EVENT_INVALID']],
  [429, 'TOO_MANY_REQUESTS', TASK_ERRORS['TOO_MANY_REQUESTS']],
  [403, 'FORBIDDEN', PERMISSION_CHANGED],
])('%i는 칸 아래 문구로 보인다', async (status, code, text) => {
  const { api, handlers } = setup()
  api.on('POST', BASE, () => json({ error: code }, status))
  const input = await add('청소')
  expect((await screen.findByRole('alert')).textContent).toBe(text)
  expect((input as HTMLInputElement).value).toBe('청소')
  if (status === 403) expect(handlers.onForbidden).toHaveBeenCalled()
})

test('끝남에는 빠른 추가가 없다', async () => {
  setup()
  await screen.findByRole('textbox', { name: '새 업무' })
  fireEvent.click(screen.getByRole('button', { name: '끝남' }))
  await waitFor(() => expect(screen.queryByRole('textbox', { name: '새 업무' })).toBeNull())
})

test('행사의 업무 탭은 그 행사의 선택지를 읽고 그 행사로 만든다', async () => {
  const api = mockApi()
  api.on('GET', `${BASE}?view=all&status=open&event=${EVENT_ID}`, empty)
  api.on('GET', `${BASE}/options?event=${EVENT_ID}`, () => json(leaderOptions))
  api.on('POST', BASE, () =>
    json({ task: taskDetail({ event: { id: EVENT_ID, name: '행사' } }) }, 201),
  )
  render(
    <TasksPage
      view={councilView(COUNCIL_ID)}
      eventId={EVENT_ID}
      initialCreate
      onForbidden={() => {}}
      onChanged={() => {}}
    />,
  )
  const input = await screen.findByRole('textbox', { name: '새 업무' })
  expect(document.activeElement).toBe(input)
  await add('청소')
  await waitFor(() =>
    expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
      eventId: EVENT_ID,
    }),
  )
  expect(screen.queryByText('추가한 업무는 이 보기에 없음')).toBeNull()
})

test('행사의 업무 탭에서 그 행사에 이을 부서가 없으면 빠른 추가 칸이 없다', async () => {
  const api = mockApi()
  api.on('GET', `${BASE}?view=all&status=open&event=${EVENT_ID}`, empty)
  const councilOnly: TaskCreateOptionsResponse = {
    departments: [{ id: null, name: null, assignees: [ME] }],
    linkableEvents: [],
  }
  api.on('GET', `${BASE}/options?event=${EVENT_ID}`, () => json(councilOnly))
  render(
    <TasksPage view={member()} eventId={EVENT_ID} onForbidden={() => {}} onChanged={() => {}} />,
  )
  await waitFor(() =>
    expect(api.calls.some(call => call.path === `${BASE}/options?event=${EVENT_ID}`)).toBe(true),
  )
  await settle()
  expect(screen.queryByRole('textbox', { name: '새 업무' })).toBeNull()
})

test('선택지를 읽지 못했으면 누를 때 이유를 보인다', async () => {
  const { posts } = setup(null)
  await screen.findByRole('textbox', { name: '새 업무' })
  await add('청소')
  expect((await screen.findByRole('alert')).textContent).toMatch(/불러오지 못했어요/)
  expect(posts()).toHaveLength(0)
})
