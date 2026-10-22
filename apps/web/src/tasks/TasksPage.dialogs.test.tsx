// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { TASK_LOST } from '@/lib/messages'
import TasksPage from './TasksPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const BASE = '/api/organizations/c1/tasks'
const LIST = `${BASE}?view=mine&status=open`
const summary: TaskSummary = {
  id: 't1',
  title: '현수막 주문',
  status: 'todo',
  dueDate: null,
  overdue: false,
  department: null,
  event: null,
  assignee: null,
  actions: ['task.status', 'task.manage'],
}

function setup() {
  const api = mockApi()
  api.on('GET', LIST, () => json({ tasks: [summary], truncated: false }))
  api.on('GET', `${BASE}/t1`, () => json({ task: taskDetail() }))
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  api.on('GET', '/api/organizations/c1/events', () => json({ events: [], truncated: false }))
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(<TasksPage view={councilView('c1')} {...handlers} />)
  const reads = () => api.calls.filter(call => call.path === LIST).length
  return { api, handlers, reads }
}

test('카드 제목을 누르면 상세가 열리고, 상태를 바꾸면 목록과 수를 다시 읽는다', async () => {
  const { api, handlers, reads } = setup()
  api.on('POST', `${BASE}/t1/status`, () => json({ task: taskDetail({ status: 'in_progress' }) }))
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
  api.on('POST', BASE, () => json({ task: taskDetail() }, 201))
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
  api.on('POST', `${BASE}/t1/status`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  fireEvent.click(await screen.findByRole('button', { name: '끝남' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(TASK_LOST)
})

test('바꾸는 중 권한을 잃으면(403) 학생회를 다시 읽게 하고 이유를 보인다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${BASE}/t1/status`, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  fireEvent.click(await screen.findByRole('button', { name: '끝남' }))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/권한이 바뀌었어요/)
})
