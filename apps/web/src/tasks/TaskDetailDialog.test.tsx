// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskDetail } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { eventSummary } from '@/test-support/event-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { TASK_LOST } from '@/lib/messages'
import { TaskDetailDialog } from './TaskDetailDialog'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const URL_TASK = '/api/organizations/c1/tasks/t1'
const E1 = '00000000-0000-4000-8000-0000000000e1'
const E2 = '00000000-0000-4000-8000-0000000000e2'

function setup(task: TaskDetail = taskDetail()) {
  const api = mockApi()
  api.on('GET', URL_TASK, () => json({ task }))
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  api.on('GET', '/api/organizations/c1/events', () =>
    json({
      events: [
        eventSummary({ id: E1, name: '환영회' }),
        eventSummary({ id: E2, name: '체육대회' }),
      ],
      truncated: false,
    }),
  )
  const handlers = {
    onClose: vi.fn(),
    onChanged: vi.fn(),
    onLost: vi.fn(),
    onForbidden: vi.fn(),
    onOpenEvent: vi.fn(),
  }
  render(<TaskDetailDialog view={councilView('c1')} taskId="t1" {...handlers} />)
  return { api, handlers }
}

test('상세는 제목, 상태, 마감, 담당 부서, 담당자, 내용, 이력 차례로 보인다', async () => {
  const { api } = setup()
  const dialog = await screen.findByRole('dialog')
  await screen.findByText('크기는 3m로 해 주세요.')
  const text = dialog.textContent ?? ''
  const order = [
    '현수막 주문',
    '상태',
    '10월 25일',
    '재정부',
    '이재정',
    '크기는 3m로 해 주세요.',
    '김회장 · 10월 20일 14:03 · 만듦',
  ].map(part => text.indexOf(part))
  expect(order.every(index => index >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order)
  api.assertNoUnexpectedRequests()
})

test('actions가 모두 있으면 상태 버튼 셋, 바꾸기 둘, 고치기, 지우기가 보인다', async () => {
  setup()
  await screen.findByText('크기는 3m로 해 주세요.')
  for (const name of [
    '할 일',
    '진행 중',
    '끝남',
    '담당 부서 바꾸기',
    '담당자 바꾸기',
    '고치기',
    '지우기',
  ])
    expect(screen.getByRole('button', { name })).toBeTruthy()
})

test('actions가 없으면 버튼이 하나도 없고 상태는 배지로만 보인다', async () => {
  setup(taskDetail({ actions: [] }))
  await screen.findByText('크기는 3m로 해 주세요.')
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).queryByRole('button', { name: '진행 중' })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: '고치기' })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: /바꾸기/ })).toBeNull()
  expect(within(dialog).getByText('할 일')).toBeTruthy()
})

test('task.status만 있으면 상태 버튼만 보인다', async () => {
  setup(taskDetail({ actions: ['task.change_status'] }))
  await screen.findByText('크기는 3m로 해 주세요.')
  expect(screen.getByRole('button', { name: '진행 중' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '담당자 바꾸기' })).toBeNull()
})

test('상태를 누르면 보내고 응답으로 바뀐다. 보내는 동안 다시 누를 수 없다', async () => {
  const { api, handlers } = setup()
  const pending = deferredResponse()
  api.on('POST', `${URL_TASK}/status`, () => pending.promise)
  fireEvent.click(await screen.findByRole('button', { name: '진행 중' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '끝남' })).toHaveProperty('disabled', true),
  )
  fireEvent.click(screen.getByRole('button', { name: '끝남' }))
  pending.resolve(json({ task: taskDetail({ status: 'in_progress' }) }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '진행 중' }).getAttribute('aria-pressed')).toBe(
      'true',
    ),
  )
  expect(api.calls.filter(call => call.method === 'POST')).toEqual([
    expect.objectContaining({ path: `${URL_TASK}/status`, body: { status: 'in_progress' } }),
  ])
  expect(handlers.onChanged).toHaveBeenCalledTimes(1)
})

test.each([
  [409, 'TASK_ASSIGNEE_INVALID', /지금 운영진만/],
  [409, 'TASK_DEPARTMENT_INVALID', /부서가 아니에요/],
  [429, 'TOO_MANY_REQUESTS', /너무 빨리/],
  [500, 'FAILED', /저장하지 못했어요/],
])('담당자 바꾸기 실패 %i %s는 그 동작 옆에 문구로 보인다', async (status, code, message) => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/assignee`, () => json({ error: code }, status))
  fireEvent.click(await screen.findByRole('button', { name: '담당자 바꾸기' }))
  fireEvent.change(await screen.findByRole('combobox', { name: '담당자' }), {
    target: { value: 'm3' },
  })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(message)
  expect(screen.getByRole('combobox', { name: '담당자' })).toBeTruthy()
})

test('담당자 선택지는 그 부서의 부서원이 먼저이고 담당자 없음이 맨 뒤다', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: '담당자 바꾸기' }))
  const select = await screen.findByRole('combobox', { name: '담당자' })
  expect(
    within(select)
      .getAllByRole('option')
      .map(item => item.textContent),
  ).toEqual(['이재정', '김회장', '박새내', '담당자 없음'])
})

test('담당자를 비우면 assigneeId null을 보낸다', async () => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/assignee`, () => json({ task: taskDetail({ assignee: null }) }))
  fireEvent.click(await screen.findByRole('button', { name: '담당자 바꾸기' }))
  fireEvent.change(await screen.findByRole('combobox', { name: '담당자' }), {
    target: { value: '' },
  })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await screen.findByText('담당자 없음')
  expect(api.calls.at(-1)?.body).toEqual({ assigneeId: null })
})

test('부서를 바꾸면 departmentId를 보낸다', async () => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/department`, () =>
    json({ task: taskDetail({ department: { id: 'd2', name: '기획부' } }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '담당 부서 바꾸기' }))
  fireEvent.change(await screen.findByRole('combobox', { name: '담당 부서' }), {
    target: { value: 'd2' },
  })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await screen.findByText('기획부')
  expect(api.calls.at(-1)?.body).toEqual({ departmentId: 'd2' })
})

test('지우기는 확인을 거치고 지우면 닫는다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${URL_TASK}/delete`, () => new Response(null, { status: 204 }))
  fireEvent.click(await screen.findByRole('button', { name: '지우기' }))
  expect(api.calls.some(call => call.path.endsWith('/delete'))).toBe(false)
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: '이 업무를 지울까요?' })).getByRole('button', {
      name: '지우기',
    }),
  )
  await waitFor(() => expect(handlers.onClose).toHaveBeenCalledTimes(1))
  expect(handlers.onChanged).toHaveBeenCalledTimes(1)
})

test('지우기를 취소하면 보내지 않는다', async () => {
  const { api, handlers } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '지우기' }))
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: '이 업무를 지울까요?' })).getAllByRole(
      'button',
      {
        name: '닫기',
      },
    )[0]!,
  )
  await settle()
  expect(api.calls.filter(call => call.method === 'POST')).toEqual([])
  expect(handlers.onClose).not.toHaveBeenCalled()
})

test.each([
  ['status', 404, TASK_LOST, false],
  ['status', 403, '권한이 바뀌었어요', true],
])(
  '바꾸는 중 %s이(가) %i를 받으면 이유를 알리고 학생회를 다시 읽는다 (%s)',
  async (_, status, message, forbidden) => {
    const { api, handlers } = setup()
    api.on('POST', `${URL_TASK}/status`, () => json({ error: 'X' }, status))
    fireEvent.click(await screen.findByRole('button', { name: '끝남' }))
    await waitFor(() => expect(handlers.onLost).toHaveBeenCalledTimes(1))
    expect(handlers.onLost.mock.calls[0]?.[0]).toContain(message)
    expect(handlers.onForbidden).toHaveBeenCalledTimes(forbidden ? 1 : 0)
  },
)

test('처음 읽을 때 404이면 이유를 알린다', async () => {
  const api = mockApi()
  api.on('GET', URL_TASK, () => json({ error: 'NOT_FOUND' }, 404))
  const handlers = { onClose: vi.fn(), onChanged: vi.fn(), onLost: vi.fn(), onForbidden: vi.fn() }
  render(<TaskDetailDialog view={councilView('c1')} taskId="t1" {...handlers} />)
  await waitFor(() => expect(handlers.onLost).toHaveBeenCalledWith(TASK_LOST))
})

test('읽기에 실패하면 다시 시도할 수 있다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', URL_TASK, () =>
    ++calls === 1 ? json({ error: 'X' }, 500) : json({ task: taskDetail() }),
  )
  render(
    <TaskDetailDialog
      view={councilView('c1')}
      taskId="t1"
      onClose={vi.fn()}
      onChanged={vi.fn()}
      onLost={vi.fn()}
      onForbidden={vi.fn()}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  await screen.findByText('크기는 3m로 해 주세요.')
})

test('고치기는 제목이 공백뿐이면 보내지 않고 제목 칸 아래에 알리며, 고치면 세 칸을 보낸다', async () => {
  const { api } = setup()
  api.on('POST', URL_TASK, () =>
    json({ task: taskDetail({ title: '새 제목', body: null, dueDate: null }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = screen.getByRole('form', { name: '업무 고치기' })
  const title = within(form).getByLabelText('제목')
  fireEvent.change(title, { target: { value: '   ' } })
  const posts = () => api.calls.filter(call => call.method === 'POST').length
  fireEvent.click(within(form).getByRole('button', { name: '저장' }))
  expect(within(form).getByText('제목을 입력해 주세요')).toBeTruthy()
  expect(title.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(title))
  expect(posts()).toBe(0)
  fireEvent.change(title, { target: { value: '새 제목' } })
  expect(within(form).queryByText('제목을 입력해 주세요')).toBeNull()
  fireEvent.change(within(form).getByLabelText('내용'), { target: { value: '' } })
  fireEvent.change(within(form).getByLabelText('마감'), { target: { value: '' } })
  fireEvent.click(within(form).getByRole('button', { name: '저장' }))
  await screen.findByText('새 제목')
  expect(api.calls.at(-1)?.body).toEqual({ title: '새 제목', body: null, dueDate: null })
})

test('이어진 행사 이름이 보이고, 누르면 그 행사를 열게 한다', async () => {
  const { handlers } = setup(taskDetail({ event: { id: E1, name: '환영회' } }))
  fireEvent.click(await screen.findByRole('button', { name: '환영회' }))
  expect(handlers.onOpenEvent).toHaveBeenCalledWith(E1)
})

test('행사가 없으면 행사 없음이 보이고 누를 곳이 없다', async () => {
  setup()
  await screen.findByText('크기는 3m로 해 주세요.')
  expect(screen.getByText('행사 없음')).toBeTruthy()
})

test('고치기에서 행사를 바꾸면 행사를 보내고, 비우면 null을 보낸다', async () => {
  const { api } = setup(taskDetail({ event: { id: E1, name: '환영회' } }))
  api.on('POST', URL_TASK, () =>
    json({ task: taskDetail({ event: { id: E2, name: '체육대회' } }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const form = screen.getByRole('form', { name: '업무 고치기' })
  const select = within(form).getByLabelText('행사')
  await waitFor(() => expect(select).toHaveProperty('disabled', false))
  expect(select).toHaveProperty('value', E1)
  fireEvent.change(select, { target: { value: E2 } })
  fireEvent.click(within(form).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('form', { name: '업무 고치기' })).toBeNull())
  expect(api.calls.at(-1)?.body).toMatchObject({ eventId: E2 })

  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const again = screen.getByRole('form', { name: '업무 고치기' })
  const clear = within(again).getByLabelText('행사')
  await waitFor(() => expect(clear).toHaveProperty('disabled', false))
  fireEvent.change(clear, { target: { value: '' } })
  fireEvent.click(within(again).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(api.calls.at(-1)?.body).toMatchObject({ eventId: null }))
})

test('이력 줄이 판마다 보인다', async () => {
  setup(
    taskDetail({
      history: [
        {
          versionNo: 1,
          at: '2026-10-20T05:03:00.000Z',
          by: { id: 'm1', name: '김회장' },
          changes: [{ field: 'created' }],
        },
        {
          versionNo: 2,
          at: '2026-10-20T14:59:59.000Z',
          by: { id: 'm2', name: '이재정' },
          changes: [{ field: 'status', from: 'todo', to: 'in_progress' }],
        },
      ],
    }),
  )
  await screen.findByText('이재정 · 10월 20일 23:59 · 상태 할 일 → 진행 중')
})

test('지남과 떠난 담당자가 보인다', async () => {
  setup(taskDetail({ overdue: true, assignee: { id: 'm9', name: '최탈퇴', current: false } }))
  await screen.findByText('지남')
  expect(screen.getByText('떠난 사람: 최탈퇴')).toBeTruthy()
})

test('떠난 담당자 업무는 아무도 골라지지 않은 채 열리고 다른 사람을 골라 다시 맡길 수 있다', async () => {
  const { api } = setup(taskDetail({ assignee: { id: 'm9', name: '최탈퇴', current: false } }))
  api.on('POST', `${URL_TASK}/assignee`, () => json({ task: taskDetail() }))
  fireEvent.click(await screen.findByRole('button', { name: '담당자 바꾸기' }))
  const select = await screen.findByRole('combobox', { name: '담당자' })
  expect(select).toHaveProperty('value', '__current__')
  expect(screen.getByRole('button', { name: '저장' })).toHaveProperty('disabled', true)
  fireEvent.change(select, { target: { value: 'm3' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(api.calls.at(-1)?.body).toEqual({ assigneeId: 'm3' }))
})
