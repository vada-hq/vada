// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import type { Page } from './pages'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const base = `/api/organizations/${COUNCIL_ID}`
const mine = `${base}/tasks?view=mine&status=open`

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: `업무 ${id}`,
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

function open(tasks: () => { tasks: TaskSummary[]; truncated: boolean }, startPage: Page = 'chat') {
  const api = mockApi()
  api.on('GET', base, () => json(councilView(COUNCIL_ID)))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', mine, () => json(tasks()))
  render(<WorkspaceAt startPage={startPage} />)
  return api
}
const badge = async (label: string) => (await screen.findAllByLabelText(label))[0]!

test('내 업무 중 지난 것이 있으면 업무 옆에 빨간 지남 N이다', async () => {
  open(() => ({
    tasks: [task('a', { overdue: true }), task('b', { overdue: true }), task('c')],
    truncated: false,
  }))
  const el = await badge('지난 업무 2개')
  expect(el.textContent).toBe('지남 2')
  expect(el.className).toContain('bg-red-600')
})

test('지난 것이 없으면 남은 업무가 있어도 배지가 없다', async () => {
  const api = open(() => ({ tasks: [task('a'), task('b'), task('c')], truncated: true }))
  await waitFor(() => expect(api.calls.some(call => call.path === mine)).toBe(true))
  await screen.findAllByText('업무')
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByLabelText(/업무 \d/)).toBeNull()
  expect(screen.getAllByRole('button', { name: '업무' })[0]!.textContent).toBe('업무')
})

test('업무가 없으면 배지가 없다', async () => {
  const api = open(() => ({ tasks: [], truncated: false }))
  await waitFor(() => expect(api.calls.some(call => call.path === mine)).toBe(true))
  await screen.findAllByText('업무')
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByLabelText(/업무 \d/)).toBeNull()
})

test('업무 화면에서 상태를 바꾸면 옆 메뉴의 수를 다시 읽는다', async () => {
  let started = false
  const api = open(
    () => ({ tasks: started ? [] : [task('a', { overdue: true })], truncated: false }),
    'tasks',
  )
  api.on('POST', `${base}/tasks/a/status`, () => {
    started = true
    return json({ task: {} })
  })
  expect((await badge('지난 업무 1개')).textContent).toBe('지남 1')
  fireEvent.click(await screen.findByRole('button', { name: '시작' }))
  await waitFor(() => expect(screen.queryByLabelText('지난 업무 1개')).toBeNull())
})
