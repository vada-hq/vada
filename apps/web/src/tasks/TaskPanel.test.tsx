// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskDetail } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { eventSummary } from '@/test-support/event-fixtures'
import { openHistory } from '@/test-support/history'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { hasUnsavedInput, resetLeaveGuard } from '@/lib/leave-guard'
import { TASK_LOST, TASK_TEAM_FAILED } from '@/lib/messages'
import { TaskPanel } from './TaskPanel'

afterEach(() => {
  cleanup()
  resetLeaveGuard()
  vi.unstubAllGlobals()
})

const URL_TASK = '/api/organizations/c1/tasks/t1'

function setup(task: TaskDetail = taskDetail()) {
  const api = mockApi()
  api.on('GET', URL_TASK, () => json({ task }))
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  const handlers = { onClose: vi.fn(), onChanged: vi.fn(), onLost: vi.fn(), onForbidden: vi.fn() }
  render(<TaskPanel view={councilView('c1')} taskId="t1" {...handlers} />)
  return { api, handlers }
}

const posts = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(call => call.method === 'POST').map(({ path, body }) => ({ path, body }))

test('나온 곳은 읽기 권한만으로 보이고 누르면 회의의 해당 안건으로 간다', async () => {
  setup(
    taskDetail({
      actions: [],
      origin: {
        meetingId: '0199d1a0-0000-7000-8000-0000000000a1',
        meetingTitle: '안전 회의',
        agendaId: '0199d1a0-0000-7000-8000-0000000000b1',
        agendaTitle: '안전 인력',
      },
    }),
  )
  expect(await screen.findByText('나온 곳')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '안전 회의 · 안전 인력' }))
  await waitFor(() =>
    expect(window.location.pathname).toBe('/meetings/c1/0199d1a0-0000-7000-8000-0000000000a1'),
  )
  expect(new URLSearchParams(window.location.search).get('agenda')).toBe(
    '0199d1a0-0000-7000-8000-0000000000b1',
  )
})

test('나온 곳이 없는 업무는 출처 줄을 보이지 않는다', async () => {
  setup(taskDetail({ origin: null }))
  await screen.findByRole('dialog', { name: '현수막 주문' })
  expect(screen.queryByText('나온 곳')).toBeNull()
})

test('담당자 칸을 누르고 사람을 고르면 저장 버튼 없이 맡기기 API로 바로 보내고 되돌리기 띠를 단다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${URL_TASK}/assignee`, () =>
    json({ task: taskDetail({ assignee: { id: 'm3', name: '박새내', current: true } }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  fireEvent.click(await screen.findByRole('option', { name: /박새내/ }))
  await waitFor(() =>
    expect(posts(api)).toEqual([{ path: `${URL_TASK}/assignee`, body: { assigneeId: 'm3' } }]),
  )
  expect(await screen.findByText('담당자 변경: 박새내')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '저장' })).toBeNull()
  expect(handlers.onChanged).toHaveBeenCalled()
  api.assertNoUnexpectedRequests()
})

test('담당자 찾기 칸에 이름을 치면 목록이 좁혀지고 Enter로 고른다', async () => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/assignee`, () => json({ task: taskDetail() }))
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  const search = await screen.findByRole('combobox', { name: '이름으로 찾기' })
  fireEvent.change(search, { target: { value: '김' } })
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['김회장'])
  fireEvent.keyDown(search, { key: 'Enter' })
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ assigneeId: 'm1' }))
})

test('마감 칸에서 [마감 없음]을 고르면 고치기 API에 마감 칸 하나만 보낸다', async () => {
  const { api } = setup()
  api.on('POST', URL_TASK, () => json({ task: taskDetail({ dueDate: null }) }))
  fireEvent.click(await screen.findByRole('button', { name: /^마감 10월 25일/ }))
  fireEvent.click(await screen.findByRole('button', { name: '마감 없음' }))
  await waitFor(() => expect(posts(api)).toEqual([{ path: URL_TASK, body: { dueDate: null } }]))
})

test('달력에서 날을 누르면 그 날로 보낸다', async () => {
  const { api } = setup()
  api.on('POST', URL_TASK, () => json({ task: taskDetail({ dueDate: '2026-10-29' }) }))
  fireEvent.click(await screen.findByRole('button', { name: /^마감 10월 25일/ }))
  fireEvent.click(await screen.findByRole('button', { name: '10월 29일 (목)' }))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ dueDate: '2026-10-29' }))
})

test('상태 단추를 누르면 상태 API로 바로 보낸다', async () => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/status`, () => json({ task: taskDetail({ status: 'done' }) }))
  fireEvent.click(await screen.findByRole('button', { name: '끝남' }))
  await waitFor(() =>
    expect(posts(api)).toEqual([{ path: `${URL_TASK}/status`, body: { status: 'done' } }]),
  )
})

test('제목을 누르면 그 자리에서 고치고 Enter로 제목 하나만 보낸다', async () => {
  const { api } = setup()
  api.on('POST', URL_TASK, () => json({ task: taskDetail({ title: '현수막 두 장 주문' }) }))
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const box = screen.getByRole('textbox', { name: '제목' })
  fireEvent.change(box, { target: { value: '현수막 두 장 주문' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  await waitFor(() =>
    expect(posts(api)).toEqual([{ path: URL_TASK, body: { title: '현수막 두 장 주문' } }]),
  )
  expect(await screen.findByRole('button', { name: '현수막 두 장 주문' })).toBeTruthy()
})

test('제목을 비우면 보내지 않고 칸 아래에 알린다', async () => {
  const { api } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const box = screen.getByRole('textbox', { name: '제목' })
  fireEvent.change(box, { target: { value: '   ' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  expect(await screen.findByText('제목을 입력해 주세요')).toBeTruthy()
  expect(posts(api)).toEqual([])
})

test('고치는 칸의 Esc는 고치기만 거두고 패널은 닫지 않는다. 그다음 Esc는 패널을 닫는다', async () => {
  const { api, handlers } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const box = screen.getByRole('textbox', { name: '제목' })
  fireEvent.change(box, { target: { value: '바뀐 제목' } })
  fireEvent.keyDown(box, { key: 'Escape' })
  expect(screen.queryByRole('textbox', { name: '제목' })).toBeNull()
  expect(handlers.onClose).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('button', { name: '현수막 주문' }), { key: 'Escape' })
  await waitFor(() => expect(handlers.onClose).toHaveBeenCalled())
  expect(posts(api)).toEqual([])
})

test('고르기 창의 Esc는 창만 닫고 패널은 남는다', async () => {
  const { handlers } = setup()
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  const search = await screen.findByRole('combobox', { name: '이름으로 찾기' })
  fireEvent.keyDown(search, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('combobox', { name: '이름으로 찾기' })).toBeNull())
  expect(handlers.onClose).not.toHaveBeenCalled()
})

test('바꾸는 동작이 없으면 값은 글자뿐이고 고치는 단추도 지우기도 없다', async () => {
  const { api } = setup(
    taskDetail({
      actions: [],
      results: [
        {
          kind: 'request',
          id: 'r1',
          title: '현수막 구매',
          stage: 'in_progress',
          eventId: null,
          roomId: null,
        },
      ],
    }),
  )
  const panel = await screen.findByRole('dialog', { name: '현수막 주문' })
  await within(panel).findByText('이재정')
  expect(within(panel).queryByRole('button', { name: '담당자 이재정' })).toBeNull()
  expect(within(panel).queryByRole('button', { name: '현수막 주문' })).toBeNull()
  expect(within(panel).queryByRole('group', { name: '상태' })).toBeNull()
  expect(within(panel).queryByRole('button', { name: '만들기' })).toBeNull()
  expect(within(panel).getByText('현수막 구매')).toBeTruthy()
  fireEvent.keyDown(within(panel).getByRole('button', { name: '더 보기' }), { key: 'Enter' })
  const items = await screen.findAllByRole('menuitem')
  expect(items.map(item => item.textContent)).toEqual(['링크 복사', '이력 보기'])
  // 바꿀 수 없으면 사람 목록도 읽지 않는다.
  expect(api.calls.some(call => call.path.endsWith('/members'))).toBe(false)
})

test('결과물 [만들기] 메뉴는 만들면 업무 상태가 어떻게 바뀌는지 함께 보인다', async () => {
  setup(taskDetail({ canMake: ['request', 'message'] }))
  expect(await screen.findByText('만들면 업무 상태가 저절로 바뀌어요')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('button', { name: '만들기' }), { key: 'Enter' })
  const items = await screen.findAllByRole('menuitem')
  expect(items.map(item => item.textContent)).toEqual([
    '구매 요청내면 진행 중, 모두 결제되면 끝남',
    '공지공지방에 올리면 끝남',
  ])
})

// 아래는 옛 상세 대화상자(TaskDetailDialog)에서 옮긴, 패널에서도 그대로인 규칙이다.

const E1 = '00000000-0000-4000-8000-0000000000e1'
const E2 = '00000000-0000-4000-8000-0000000000e2'

// 이을 수 있는 행사: 재정부(d1) 업무는 기본으로 둘 다다.
function withEvents(api: ReturnType<typeof mockApi>, linkable = [E1, E2]) {
  api.on('GET', '/api/organizations/c1/tasks/options', () =>
    json({
      departments: [],
      linkableEvents: [
        { departmentId: 'd1', eventIds: linkable },
        { departmentId: null, eventIds: [E1, E2] },
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

const optionNames = () => screen.getAllByRole('option').map(option => option.textContent)
const freshHandlers = () => ({
  onClose: vi.fn(),
  onChanged: vi.fn(),
  onLost: vi.fn(),
  onForbidden: vi.fn(),
})

test('상세는 제목, 상태, 담당자·마감·담당 부서·행사, 설명 차례로 보이고 이력은 메뉴 안에 있다', async () => {
  const { api } = setup()
  const panel = await screen.findByRole('dialog', { name: '현수막 주문' })
  await within(panel).findByText('크기는 3m로 해 주세요.')
  const text = panel.textContent ?? ''
  const order = [
    '현수막 주문',
    '할 일',
    '이재정',
    '10월 25일',
    '재정부',
    '행사 없음',
    '크기는 3m로',
  ].map(part => text.indexOf(part))
  expect(order.every(index => index >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order)
  expect(within(panel).queryByRole('region', { name: '이력' })).toBeNull()
  api.assertNoUnexpectedRequests()
})

test('actions가 모두 있으면 상태 단추 셋, 바꾸는 칸 넷, 머리 메뉴에 링크 복사·지우기·이력 보기가 있다', async () => {
  setup()
  await screen.findByText('크기는 3m로 해 주세요.')
  for (const name of ['할 일', '진행 중', '끝남'])
    expect(screen.getByRole('button', { name })).toBeTruthy()
  for (const name of [/^담당자 /, /^마감 /, /^담당 부서 /, /^행사 /])
    expect(screen.getByRole('button', { name })).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('button', { name: '더 보기' }), { key: 'Enter' })
  const items = await screen.findAllByRole('menuitem')
  expect(items.map(item => item.textContent)).toEqual(['링크 복사', '지우기', '이력 보기'])
})

test('task.change_status만 있으면 상태 단추만 누르고 칸과 제목은 글자뿐이다', async () => {
  setup(taskDetail({ actions: ['task.change_status'] }))
  await screen.findByText('크기는 3m로 해 주세요.')
  expect(screen.getByRole('button', { name: '진행 중' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^담당자 / })).toBeNull()
  expect(screen.queryByRole('button', { name: /^마감 / })).toBeNull()
  expect(screen.queryByRole('button', { name: '현수막 주문' })).toBeNull()
})

test('상태를 보내는 동안 다시 누를 수 없고 응답으로 바뀐다', async () => {
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
  expect(posts(api)).toEqual([{ path: `${URL_TASK}/status`, body: { status: 'in_progress' } }])
  expect(handlers.onChanged).toHaveBeenCalledTimes(1)
})

test.each([
  [409, 'TASK_ASSIGNEE_INVALID', /지금 운영진만/],
  [409, 'TASK_DEPARTMENT_INVALID', /부서가 아니에요/],
  [429, 'TOO_MANY_REQUESTS', /너무 빨리/],
  [500, 'FAILED', /저장하지 못했어요/],
])('담당자 바꾸기 실패 %i %s는 담당자 칸 아래에 문구로 보인다', async (status, code, message) => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/assignee`, () => json({ error: code }, status))
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  fireEvent.click(await screen.findByRole('option', { name: /박새내/ }))
  expect((await screen.findByRole('alert')).textContent).toMatch(message)
})

test('담당자 선택지는 그 부서의 부서원이 먼저이고 담당자 없음이 맨 뒤다. 없음을 고르면 null을 보낸다', async () => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/assignee`, () => json({ task: taskDetail({ assignee: null }) }))
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  await screen.findByRole('combobox', { name: '이름으로 찾기' })
  expect(optionNames().map(name => name?.replace('재정부', ''))).toEqual([
    '이재정',
    '김회장',
    '박새내',
    '담당자 없음',
  ])
  fireEvent.click(screen.getByRole('option', { name: '담당자 없음' }))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ assigneeId: null }))
})

test('부서를 고르면 departmentId를 보낸다', async () => {
  const { api } = setup()
  api.on('POST', `${URL_TASK}/department`, () =>
    json({ task: taskDetail({ department: { id: 'd2', name: '기획부' } }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: /^담당 부서 재정부/ }))
  fireEvent.click(await screen.findByRole('option', { name: '기획부' }))
  await screen.findByRole('button', { name: /^담당 부서 기획부/ })
  expect(posts(api)).toEqual([{ path: `${URL_TASK}/department`, body: { departmentId: 'd2' } }])
})

async function askDelete() {
  fireEvent.keyDown(await screen.findByRole('button', { name: '더 보기' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '지우기' }))
  return await screen.findByRole('dialog', { name: '이 업무를 지울까요?' })
}

test('머리 메뉴의 지우기는 확인을 거치고 지우면 닫는다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${URL_TASK}/delete`, () => new Response(null, { status: 204 }))
  const confirm = await askDelete()
  expect(posts(api)).toEqual([])
  fireEvent.click(within(confirm).getByRole('button', { name: '지우기' }))
  await waitFor(() => expect(handlers.onClose).toHaveBeenCalledTimes(1))
  expect(handlers.onChanged).toHaveBeenCalledTimes(1)
})

test('지우기를 닫으면 보내지 않고 패널은 남는다', async () => {
  const { api, handlers } = setup()
  const confirm = await askDelete()
  fireEvent.click(within(confirm).getAllByRole('button', { name: '닫기' })[0]!)
  await settle()
  expect(posts(api)).toEqual([])
  expect(handlers.onClose).not.toHaveBeenCalled()
})

test.each([
  [404, TASK_LOST, false],
  [403, '권한이 바뀌었어요', true],
])(
  '바꾸는 중 %i를 받으면 이유를 알리고 403이면 학생회를 다시 읽는다',
  async (status, message, forbidden) => {
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
  const handlers = freshHandlers()
  render(<TaskPanel view={councilView('c1')} taskId="t1" {...handlers} />)
  await waitFor(() => expect(handlers.onLost).toHaveBeenCalledWith(TASK_LOST))
})

test('읽기에 실패하면 다시 시도할 수 있다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', URL_TASK, () =>
    ++calls === 1 ? json({ error: 'X' }, 500) : json({ task: taskDetail() }),
  )
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  render(<TaskPanel view={councilView('c1')} taskId="t1" {...freshHandlers()} />)
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  await screen.findByText('크기는 3m로 해 주세요.')
})

test('이어진 행사의 ↗를 누르면 그 행사를 열게 하고, 행사가 없으면 행사 없음이다', async () => {
  const api = mockApi()
  api.on('GET', URL_TASK, () => json({ task: taskDetail({ event: { id: E1, name: '환영회' } }) }))
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  const onOpenEvent = vi.fn()
  render(
    <TaskPanel
      view={councilView('c1')}
      taskId="t1"
      onOpenEvent={onOpenEvent}
      {...freshHandlers()}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: '환영회 열기' }))
  expect(onOpenEvent).toHaveBeenCalledWith(E1)
  cleanup()
  setup()
  expect(await screen.findByRole('button', { name: '행사 행사 없음' })).toBeTruthy()
})

test('행사 칸에서 행사를 고르면 그 행사를, 행사 없음을 고르면 null을 보낸다', async () => {
  const { api } = setup(taskDetail({ event: { id: E1, name: '환영회' } }))
  withEvents(api)
  api.on('POST', URL_TASK, () =>
    json({ task: taskDetail({ event: { id: E2, name: '체육대회' } }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '행사 환영회' }))
  fireEvent.click(await screen.findByRole('option', { name: '체육대회' }))
  await waitFor(() => expect(posts(api)).toEqual([{ path: URL_TASK, body: { eventId: E2 } }]))
  fireEvent.click(await screen.findByRole('button', { name: '행사 체육대회' }))
  fireEvent.click(await screen.findByRole('option', { name: '행사 없음' }))
  await waitFor(() => expect(posts(api)[1]?.body).toEqual({ eventId: null }))
})

test('행사 선택지에 그 업무 부서로 이을 수 없는 행사가 없고, 지금 이은 행사는 남는다', async () => {
  const { api } = setup(taskDetail({ event: { id: E2, name: '체육대회' } }))
  withEvents(api, [E1])
  fireEvent.click(await screen.findByRole('button', { name: '행사 체육대회' }))
  await screen.findByRole('option', { name: '환영회' })
  expect(optionNames()).toEqual(['행사 없음', '환영회', '체육대회'])
  cleanup()
  const fresh = setup()
  withEvents(fresh.api, [E1])
  fireEvent.click(await screen.findByRole('button', { name: '행사 행사 없음' }))
  await screen.findByRole('option', { name: '환영회' })
  expect(optionNames()).toEqual(['행사 없음', '환영회'])
})

test('이을 수 있는 행사를 읽기 전에는 행사 창이 불러오는 중이다', async () => {
  const { api } = setup()
  withEvents(api)
  api.on('GET', '/api/organizations/c1/tasks/options', () => deferredResponse().promise)
  fireEvent.click(await screen.findByRole('button', { name: '행사 행사 없음' }))
  expect(await screen.findByText('불러오는 중이에요')).toBeTruthy()
  expect(screen.queryByRole('option')).toBeNull()
})

test('이력 줄이 판마다 보이고 [닫기]는 이력 창만 닫는다', async () => {
  setup(
    taskDetail({
      history: [
        {
          versionNo: 1,
          at: '2026-10-20T05:03:00.000Z',
          by: { id: 'm1', name: '김회장' },
          cause: null,
          changes: [{ field: 'created' }],
        },
        {
          versionNo: 2,
          at: '2026-10-20T14:59:59.000Z',
          by: { id: 'm2', name: '이재정' },
          cause: null,
          changes: [{ field: 'status', from: 'todo', to: 'in_progress' }],
        },
      ],
    }),
  )
  const history = await openHistory()
  expect(
    within(history)
      .getAllByRole('listitem')
      .map(item => item.textContent),
  ).toEqual(['김회장 · 10월 20일 14:03 · 만듦', '이재정 · 10월 20일 23:59 · 상태 할 일 → 진행 중'])
  fireEvent.click(within(history).getByText('닫기'))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '이력' })).toBeNull())
  expect(screen.getByRole('dialog', { name: '현수막 주문' })).toBeTruthy()
})

test('지남과 떠난 담당자가 보이고, 떠난 담당자 업무는 다른 사람을 골라 다시 맡긴다', async () => {
  const { api } = setup(
    taskDetail({ overdue: true, assignee: { id: 'm9', name: '최탈퇴', current: false } }),
  )
  api.on('POST', `${URL_TASK}/assignee`, () => json({ task: taskDetail() }))
  expect(await screen.findByText('지남')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '담당자 떠난 사람: 최탈퇴' }))
  await screen.findByRole('combobox', { name: '이름으로 찾기' })
  expect(
    screen.getAllByRole('option').some(option => option.getAttribute('aria-selected') === 'true'),
  ).toBe(false)
  fireEvent.click(screen.getByRole('option', { name: /박새내/ }))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ assigneeId: 'm3' }))
})

test('고치던 글이 원래 값과 다른 동안만 떠날 때 확인이 걸리고, 되돌리거나 Esc로 거두면 풀린다', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const box = screen.getByRole('textbox', { name: '제목' })
  expect(hasUnsavedInput()).toBe(false)
  fireEvent.change(box, { target: { value: '다른 제목' } })
  expect(hasUnsavedInput()).toBe(true)
  fireEvent.change(box, { target: { value: '현수막 주문' } })
  expect(hasUnsavedInput()).toBe(false)
  fireEvent.change(box, { target: { value: '다른 제목' } })
  fireEvent.keyDown(box, { key: 'Escape' })
  expect(hasUnsavedInput()).toBe(false)
})

test('사람·부서 목록을 읽지 못하면 담당자 창에 그 이유를 보인다', async () => {
  const { api } = setup()
  api.on('GET', '/api/organizations/c1/members', () => json({ error: 'X' }, 500))
  fireEvent.click(await screen.findByRole('button', { name: '담당자 이재정' }))
  expect(await screen.findByText(TASK_TEAM_FAILED)).toBeTruthy()
})
