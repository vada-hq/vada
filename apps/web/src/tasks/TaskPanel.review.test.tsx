// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskDetail } from '@vada/contracts'
import LeaveConfirm from '@/components/LeaveConfirm'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { LEAVE_CONFIRM, LEAVE_TITLE, TASK_FAILED } from '@/lib/messages'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { eventSummary } from '@/test-support/event-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { TaskPanel } from './TaskPanel'

const URL_TASK = '/api/organizations/c1/tasks/t1'
const E1 = '00000000-0000-4000-8000-0000000000e1'
const E2 = '00000000-0000-4000-8000-0000000000e2'

afterEach(() => {
  cleanup()
  resetLeaveGuard()
  vi.unstubAllGlobals()
})

function setup(task = taskDetail()) {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const api = mockApi()
  api.on('GET', URL_TASK, () => json({ task }))
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  const handlers = { onClose: vi.fn(), onChanged: vi.fn(), onLost: vi.fn(), onForbidden: vi.fn() }
  render(
    <>
      <TaskPanel view={councilView('c1')} taskId="t1" {...handlers} />
      <LeaveConfirm />
    </>,
  )
  return { api, handlers }
}

function withEvents(api: ReturnType<typeof mockApi>) {
  api.on('GET', '/api/organizations/c1/tasks/options', () =>
    json({
      departments: [],
      linkableEvents: [
        { departmentId: 'd1', eventIds: [E1] },
        { departmentId: 'd2', eventIds: [E2] },
      ],
    }),
  )
  api.on('GET', '/api/organizations/c1/events', () =>
    json({
      events: [
        eventSummary({ id: E1, name: '환영회' }),
        eventSummary({ id: E2, name: '체육대회' }),
      ],
      truncated: false,
    }),
  )
}

test('행사 선택지를 읽은 뒤 부서를 바꾸면 새 부서의 행사를 다시 읽는다', async () => {
  const { api } = setup()
  withEvents(api)
  api.on('POST', `${URL_TASK}/department`, () =>
    json({ task: taskDetail({ department: { id: 'd2', name: '기획부' } }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '행사 행사 없음' }))
  await screen.findByRole('option', { name: '환영회' })
  expect(screen.queryByRole('option', { name: '체육대회' })).toBeNull()
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: '담당 부서 재정부' }))
  fireEvent.click(await screen.findByRole('option', { name: '기획부' }))
  await screen.findByRole('button', { name: '담당 부서 기획부' })
  fireEvent.click(screen.getByRole('button', { name: '행사 행사 없음' }))
  await screen.findByRole('option', { name: '체육대회' })
  expect(screen.queryByRole('option', { name: '환영회' })).toBeNull()
  expect(api.calls.filter(call => call.path.endsWith('/tasks/options'))).toHaveLength(2)
  expect(api.calls.filter(call => call.path.endsWith('/events'))).toHaveLength(2)
  api.assertNoUnexpectedRequests()
})

const dismiss = {
  닫기: () => fireEvent.click(screen.getByRole('button', { name: '닫기' })),
  Esc: () => fireEvent.keyDown(screen.getByRole('button', { name: '닫기' }), { key: 'Escape' }),
  바깥: () => {
    fireEvent.pointerDown(document.body, { button: 0 })
    fireEvent.pointerUp(document.body, { button: 0 })
    fireEvent.click(document.body)
  },
}

test.each(Object.entries(dismiss))(
  '검증 오류가 남은 제목은 %s 전에 떠날지 묻는다',
  async (_, close) => {
    const { api, handlers } = setup()
    fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
    const box = screen.getByRole('textbox', { name: '제목' })
    fireEvent.change(box, { target: { value: '   ' } })
    fireEvent.blur(box)
    await screen.findByText('제목을 입력해 주세요')
    await settle()
    close()
    const confirm = await screen.findByRole('dialog', { name: LEAVE_TITLE })
    expect(handlers.onClose).not.toHaveBeenCalled()
    fireEvent.click(within(confirm).getAllByRole('button', { name: '닫기' })[0]!)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull())
    expect(screen.getByRole('textbox', { name: '제목' })).toHaveProperty('value', '   ')
    expect(handlers.onClose).not.toHaveBeenCalled()
    expect(api.calls.filter(call => call.method === 'POST')).toEqual([])
  },
)

test.each(Object.entries(dismiss))(
  '저장에 실패한 설명은 %s 전에 묻고 나가기를 골라야 닫는다',
  async (_, close) => {
    const { api, handlers } = setup()
    api.on('POST', URL_TASK, () => json({ error: 'FAILED' }, 500))
    fireEvent.click(await screen.findByRole('button', { name: '크기는 3m로 해 주세요.' }))
    const box = screen.getByRole('textbox', { name: '설명' })
    fireEvent.change(box, { target: { value: '저장하지 못한 설명' } })
    fireEvent.blur(box)
    await screen.findByText(TASK_FAILED)
    await settle()
    close()
    const confirm = await screen.findByRole('dialog', { name: LEAVE_TITLE })
    expect(handlers.onClose).not.toHaveBeenCalled()
    fireEvent.click(within(confirm).getByRole('button', { name: LEAVE_CONFIRM }))
    await waitFor(() => expect(handlers.onClose).toHaveBeenCalledTimes(1))
  },
)

const picks: { trigger: RegExp; option: string; path: string; next: Partial<TaskDetail> }[] = [
  {
    trigger: /^담당자 이재정/,
    option: '담당자 없음',
    path: '/assignee',
    next: { assignee: null },
  },
  { trigger: /^마감 10월 25일/, option: '마감 없음', path: '', next: { dueDate: null } },
  {
    trigger: /^담당 부서 재정부/,
    option: '기획부',
    path: '/department',
    next: { department: { id: 'd2', name: '기획부' } },
  },
  {
    trigger: /^행사 행사 없음/,
    option: '환영회',
    path: '',
    next: { event: { id: E1, name: '환영회' } },
  },
]

test.each(picks)('$option 선택을 저장한 뒤 초점을 선택한 칸으로 돌린다', async pick => {
  const { api } = setup()
  withEvents(api)
  const pending = deferredResponse()
  api.on('POST', `${URL_TASK}${pick.path}`, () => pending.promise)
  const trigger = await screen.findByRole('button', { name: pick.trigger })
  fireEvent.click(trigger)
  fireEvent.click(
    await screen.findByRole(pick.path === '' && pick.next.dueDate === null ? 'button' : 'option', {
      name: pick.option,
    }),
  )
  await waitFor(() => expect(trigger).toHaveProperty('disabled', true))
  pending.resolve(json({ task: taskDetail(pick.next) }))
  await waitFor(() => expect(trigger).toHaveProperty('disabled', false))
  await waitFor(() => expect(document.activeElement).toBe(trigger))
})
