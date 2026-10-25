// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { TASK_LOST } from '@/lib/messages'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { useHere } from '@/lib/app-location'
import TasksPage from './TasksPage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const BASE = `/api/organizations/${COUNCIL_ID}/tasks`
const LIST = `${BASE}?view=mine&status=open`
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

test('업무 만들기로 만들면 대화상자가 닫히고 목록과 수를 다시 읽는다', async () => {
  const { api, handlers, reads } = setup()
  api.on('POST', BASE, () => json({ task: taskDetail({ id: T1 }) }, 201))
  await screen.findByRole('button', { name: '현수막 주문' })
  const before = reads()
  fireEvent.click(screen.getByRole('button', { name: '업무 만들기' }))
  await screen.findByRole('combobox', { name: '담당 부서' })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청소' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onChanged).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
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
