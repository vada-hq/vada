// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MyTasksResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import MyTasks from './MyTasks'
import { taskDetail, taskSummary } from './task-fixtures'
import { taskBadge } from './task-view'
import { useMyTasks } from './useTasks'

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-11T03:00:00Z')) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
const mine: MyTasksResponse = { truncated: false,
  open: [taskSummary({ id: 't1', title: '심사위원 섭외', dueOn: '2026-10-09', event: { id: 'e2', name: '학술제' } }),
    taskSummary({ id: 't2', title: '포스터 디자인', status: 'doing' })],
  done: [taskSummary({ id: 't3', title: '대관 신청', status: 'done', completedAt: '2026-10-05T00:00:00Z' })] }
const onOpenEvent = vi.fn()
function Harness() {
  const state = useMyTasks('o1')
  return <MyTasks organizationId="o1" manageEvents state={state} onOpenEvent={onOpenEvent} />
}
const titles = (scope: HTMLElement) => within(scope).queryAllByRole('heading', { level: 3 }).map(item => item.textContent)

test('할 일은 행사 이름·상태·지연과 함께 보이고, 완료 탭으로 바꾼다. 카드를 열어 행사로 갈 수 있다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/o1/my-tasks', () => json(mine))
  api.on('GET', '/api/organizations/o1/events/e2/tasks/t1', () => json({ task: taskDetail({ id: 't1', title: '심사위원 섭외', event: { id: 'e2', name: '학술제' } }) }))
  render(<Harness />)
  const open = await screen.findByRole('region', { name: '할 일' })
  expect(titles(open)).toEqual(['심사위원 섭외', '포스터 디자인'])
  expect(within(open).getByText('학술제')).toBeTruthy()
  expect(within(open).getByText('10.9 · 지연')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '완료 1' }))
  expect(titles(screen.getByRole('region', { name: '완료' }))).toEqual(['대관 신청'])
  fireEvent.click(screen.getByRole('button', { name: '할 일 2' }))
  fireEvent.click(within(screen.getByRole('region', { name: '할 일' })).getByRole('button', { name: '심사위원 섭외' }))
  fireEvent.click(await screen.findByRole('button', { name: '행사로 가기' }))
  expect(onOpenEvent).toHaveBeenCalledWith('e2')
})

test('카드의 완료 버튼은 그 행사의 업무 상태를 바꾸고 내 업무를 새로 불러온다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', '/api/organizations/o1/my-tasks', () => { calls++; return json(mine) })
  api.on('POST', '/api/organizations/o1/events/e1/tasks/t2/status', () => json({ task: taskDetail({ id: 't2', status: 'done', version: 2 }) }))
  render(<Harness />)
  const open = await screen.findByRole('region', { name: '할 일' })
  fireEvent.click(within(open).getByRole('button', { name: '완료' }))
  await vi.waitFor(() => expect(calls).toBe(2))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ version: 1, status: 'done' })
})

test('맡은 업무가 없으면 빈 상태를 보인다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/o1/my-tasks', () => json({ open: [], done: [], truncated: false }))
  render(<Harness />)
  expect(await screen.findByText('맡은 업무가 없어요')).toBeTruthy()
})

test('옆 메뉴 수: 지연이 있으면 지연 수, 없으면 할 일 수, 할 일이 없으면 없다', () => {
  expect(taskBadge(mine, '2026-10-11')).toEqual({ tone: 'danger', text: '지연 1' })
  expect(taskBadge({ ...mine, open: mine.open.slice(1) }, '2026-10-11')).toEqual({ tone: 'info', text: '1' })
  expect(taskBadge({ ...mine, open: [] }, '2026-10-11')).toBeNull()
  expect(taskBadge(null, '2026-10-11')).toBeNull()
})

test('상세의 수정은 그 자리에서 수정 화면을 열고, 저장하면 내 업무를 새로 불러온다', async () => {
  onOpenEvent.mockClear()
  const api = mockApi()
  let calls = 0
  api.on('GET', '/api/organizations/o1/my-tasks', () => { calls++; return json(mine) })
  const detail = taskDetail({ id: 't1', title: '심사위원 섭외', event: { id: 'e2', name: '학술제' } })
  api.on('GET', '/api/organizations/o1/events/e2/tasks/t1', () => json({ task: detail }))
  api.on('GET', '/api/organizations/o1/members', () => json({ viewer: {}, departments: [{ id: 'd1', name: '기획부', isLeadership: false, handlesFinance: false }],
    members: [{ id: 'm2', name: '윤태민', title: null, departmentId: 'd1' }] }))
  api.on('PATCH', '/api/organizations/o1/events/e2/tasks/t1', () => json({ task: { ...detail, title: '심사위원 두 분 섭외', version: 2 } }))
  render(<Harness />)
  fireEvent.click(within(await screen.findByRole('region', { name: '할 일' })).getByRole('button', { name: '심사위원 섭외' }))
  fireEvent.click(await screen.findByRole('button', { name: '수정' }))
  const form = await screen.findByRole('dialog', { name: '업무 수정' })
  fireEvent.change(within(form).getByLabelText('제목'), { target: { value: '심사위원 두 분 섭외' } })
  fireEvent.click(within(form).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(calls).toBe(2))
  expect(api.calls.find(call => call.method === 'PATCH')?.body).toMatchObject({ version: 1, title: '심사위원 두 분 섭외' })
  expect(screen.queryByRole('dialog', { name: '업무 수정' })).toBeNull()
  expect(onOpenEvent).not.toHaveBeenCalled()
})
