// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { EVENT_ID, eventDetail, eventSummary } from '@/test-support/event-fixtures'
import { homeResponse, onHomeExtras } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { LEAVE_CONFIRM, LEAVE_TITLE } from '@/lib/messages'
import { rememberTaskLayout } from '@/lib/task-layout'
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'
import type { Page } from './pages'

const base = `/api/organizations/${COUNCIL_ID}`
const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const T2 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e70'
const T3 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e71'
const EVENT2 = '00000000-0000-4000-8000-0000000000e2'
const EVENT_AT = `/events/${COUNCIL_ID}/${EVENT_ID}`
// 행사는 메시지 탭이 기본이라(022 정한 것 28) 개요는 쿼리에 남는다.
const OVERVIEW_AT = `${EVENT_AT}?tab=overview`
const pathNow = () => window.location.pathname + window.location.search
const settle = () => act(() => windowHistoryIdle())

const eventTask: TaskSummary = {
  id: T1,
  title: '현수막 주문',
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: false,
  department: null,
  event: { id: EVENT_ID, name: '신입생 환영회' },
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.change_status'],
}

let api: ReturnType<typeof mockApi>
function setup(path: string, detail: () => Response = () => json({ event: eventDetail({}, []) })) {
  api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all&event=${EVENT_ID}`, () =>
    json({
      requests: [],
      truncated: false,
      stageCounts: { pending: 0, unpaid: 0, paid: 0, closed: 0 },
    }),
  )
  onHomeExtras(api, {}, COUNCIL_ID)
  api.on('GET', base, () => json(councilView(COUNCIL_ID)))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/home`, () => json(homeResponse()))
  api.on('GET', `${base}/accounts`, () => json({ accounts: [], truncated: false }))
  api.on('GET', `${base}/events`, () =>
    json({
      events: [eventSummary(), eventSummary({ id: EVENT2, name: '둘째 행사' })],
      truncated: false,
    }),
  )
  api.on('GET', `${base}/events/${EVENT_ID}`, detail)
  api.on('GET', `${base}/events/${EVENT_ID}/rooms`, () => json({ rooms: [], archived: false }))
  api.on('GET', `${base}/events/${EVENT2}/rooms`, () => json({ rooms: [], archived: false }))
  api.on('GET', `${base}/events/${EVENT_ID}/settlement`, () =>
    json(settlementOf({ remaining: [], settled: true })),
  )
  api.on('GET', `${base}/events/${EVENT_ID}/registration-forms`, () =>
    json({ forms: [], truncated: false, actions: ['form.create'] }),
  )
  const open = () => json({ tasks: [eventTask], truncated: false })
  api.on('GET', `${base}/tasks?view=all&status=open&event=${EVENT_ID}`, open)
  for (const taskScope of ['mine', 'all'])
    api.on(
      'GET',
      `${base}/tasks?view=${taskScope}&status=open${taskScope === 'all' ? '&event=none' : ''}`,
      open,
    )
  api.on('GET', `${base}/tasks?view=mine&status=done`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/tasks/${T1}`, () =>
    json({
      task: taskDetail({
        id: T1,
        title: '현수막 주문',
        event: { id: EVENT_ID, name: '신입생 환영회' },
      }),
    }),
  )
  window.history.replaceState(null, '', path)
  return render(<WorkspaceAt startPage={'events' satisfies Page} />)
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  resetLeaveGuard()
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  resetLeaveGuard()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const selected = (name: string) =>
  screen.findByRole('tab', { name }).then(tab => tab.getAttribute('aria-selected'))

test('행사 주소의 탭이 열리고, 새로 고침해도 같다', async () => {
  const view = setup(`${EVENT_AT}?tab=money`)
  expect(await selected('구매')).toBe('true')
  view.unmount()
  setup(`${EVENT_AT}?tab=money`)
  expect(await selected('구매')).toBe('true')
  expect(pathNow()).toBe(`${EVENT_AT}?tab=money`)
})

test('탭을 바꾸면 주소의 쿼리만 바뀌고 기록은 쌓이지 않으며, 메시지는 쿼리가 없다', async () => {
  setup(EVENT_AT)
  expect(await selected('메시지')).toBe('true')
  const push = vi.spyOn(window.history, 'pushState')
  fireEvent.click(screen.getByRole('tab', { name: '인원 관리' }))
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`))
  expect(await selected('인원 관리')).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: '메시지' }))
  await waitFor(() => expect(pathNow()).toBe(EVENT_AT))
  expect(push).not.toHaveBeenCalled()
})

test('행사 기록은 모든 탭에서 머리글과 본문이 같은 끝까지 폭이다', async () => {
  setup(EVENT_AT)
  onEventTasks()
  for (const tab of ['메시지', '개요', '업무', '인원 관리', '구매']) {
    fireEvent.click(await screen.findByRole('tab', { name: tab }))
    expect(await selected(tab)).toBe('true')
    for (const region of [screen.getByRole('banner'), screen.getByRole('main')]) {
      expect(region.firstElementChild!.className.split(' ')).toEqual(
        expect.arrayContaining(['mx-auto', 'w-full', 'max-w-none']),
      )
    }
  }
})

test('모르는 탭은 메시지로 읽고 주소를 고쳐 쓴다', async () => {
  setup(`${EVENT_AT}?tab=nope`)
  expect(await selected('메시지')).toBe('true')
  await waitFor(() => expect(pathNow()).toBe(EVENT_AT))
})

test('행사 목록에서 연 행사는 행사 주소로 한 칸 쌓이고, 뒤로는 목록이다', async () => {
  setup(`/events/${COUNCIL_ID}`)
  const push = vi.spyOn(window.history, 'pushState')
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  await selected('개요')
  expect(push).toHaveBeenCalledTimes(1)
  expect(pathNow()).toBe(EVENT_AT)
  fireEvent.click(screen.getByRole('button', { name: '행사 목록' }))
  await waitFor(() => expect(pathNow()).toBe(`/events/${COUNCIL_ID}`))
  expect(await screen.findByRole('button', { name: '둘째 행사' })).toBeTruthy()
})

test('업무에서 연 행사의 뒤로는 업무이고 들어온 곳의 이름이 붙는다', async () => {
  setup(`/tasks/${COUNCIL_ID}`)
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  await selected('개요')
  expect(pathNow()).toBe(EVENT_AT)
  expect(screen.queryByRole('button', { name: '행사 목록' })).toBeNull()
  // 뒤로 단추는 본문에 있다. 옆 메뉴의 '업무' 칸도 같은 이름이라 본문 안에서 찾는다.
  fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: '업무' }))
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}`))
  expect(await screen.findByRole('button', { name: '현수막 주문' })).toBeTruthy()
})

test('주소로 바로 들어온 행사의 뒤로는 행사 목록이다', async () => {
  setup(EVENT_AT)
  await selected('개요')
  fireEvent.click(screen.getByRole('button', { name: '행사 목록' }))
  await waitFor(() => expect(pathNow()).toBe(`/events/${COUNCIL_ID}`))
  expect(await screen.findByRole('button', { name: '둘째 행사' })).toBeTruthy()
})

test('개요에서 누른 업무는 업무 주소로 열리고, 닫으면 그 행사 개요로 돌아온다', async () => {
  setup(OVERVIEW_AT)
  const next = await screen.findByRole('region', { name: '다음 업무' })
  fireEvent.click(await within(next).findByRole('button', { name: '현수막 주문' }))
  const dialog = await screen.findByRole('dialog')
  await screen.findByRole('dialog', { name: '현수막 주문' })
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}/${T1}`)
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await settle()
  expect(pathNow()).toBe(OVERVIEW_AT)
  expect(await selected('개요')).toBe('true')
})

test('행사의 업무 탭에서 연 업무는 업무 주소로 열리고, 닫으면 그 행사의 업무 탭이다', async () => {
  setup(`${EVENT_AT}?tab=tasks`)
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const dialog = await screen.findByRole('dialog')
  await screen.findByRole('dialog', { name: '현수막 주문' })
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}/${T1}`)
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await settle()
  expect(pathNow()).toBe(`${EVENT_AT}?tab=tasks`)
  expect(await selected('업무')).toBe('true')
})

test.each([404, 403])(
  '없는 행사와 다른 학생회 행사(%i)는 찾을 수 없음이고 행사 목록으로 가는 버튼이 있다',
  async status => {
    setup(EVENT_AT, () => json({ error: status === 404 ? 'NOT_FOUND' : 'FORBIDDEN' }, status))
    expect(await screen.findByText('찾을 수 없음')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: '개요' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '행사 목록' }))
    await waitFor(() => expect(pathNow()).toBe(`/events/${COUNCIL_ID}`))
    expect(await screen.findByRole('button', { name: '둘째 행사' })).toBeTruthy()
  },
)

async function startEditing() {
  fireEvent.click(await screen.findByRole('button', { name: '참여 설문 만들기' }))
  const form = await screen.findByRole('form', { name: '신청 양식 만들기' })
  fireEvent.change(within(form).getByLabelText('양식 이름'), { target: { value: '봄 신청' } })
}

test('신청 양식을 고치다 탭을 누르면 확인이 먼저 나오고, 계속 쓰기면 그대로다', async () => {
  setup(`${EVENT_AT}?tab=registrations`)
  await startEditing()
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`)
  fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByText(LEAVE_TITLE)).toBeNull())
  expect(screen.getByRole('form', { name: '신청 양식 만들기' })).toBeTruthy()
  expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`)
})

test('신청 양식을 고치다 나가기를 고르면 탭이 바뀐다', async () => {
  setup(`${EVENT_AT}?tab=registrations`)
  await startEditing()
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(pathNow()).toBe(OVERVIEW_AT))
  expect(await selected('개요')).toBe('true')
})

test('신청 양식을 고치다 메뉴를 누르면 확인이 먼저 나온다', async () => {
  setup(`${EVENT_AT}?tab=registrations`)
  await startEditing()
  fireEvent.click(screen.getAllByRole('button', { name: /^업무/ })[0]!)
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`)
})

test('신청 양식을 고치다 화면 안 뒤로를 누르면 확인이 먼저 나온다', async () => {
  setup(`${EVENT_AT}?tab=registrations`)
  await startEditing()
  fireEvent.click(screen.getByRole('button', { name: '행사 목록' }))
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`)
})

test('신청 양식을 고치다 기기 뒤로를 누르면 한 칸 되돌려 놓고 묻는다', async () => {
  setup(`/events/${COUNCIL_ID}`)
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  await selected('개요')
  fireEvent.click(screen.getByRole('tab', { name: '인원 관리' }))
  await startEditing()
  act(() => window.history.back())
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`))
})

test('고친 것이 없으면 확인 없이 옮겨 간다', async () => {
  setup(`${EVENT_AT}?tab=registrations`)
  fireEvent.click(await screen.findByRole('button', { name: '참여 설문 만들기' }))
  await screen.findByRole('form', { name: '신청 양식 만들기' })
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  await waitFor(() => expect(pathNow()).toBe(OVERVIEW_AT))
  expect(screen.queryByText(LEAVE_TITLE)).toBeNull()
})

// 행사 업무 탭의 보기와 거르기(DEC-78, 기능 026 조각 2). 업무 메뉴와 같은 키로 행사 주소에 남는다.
function onEventTasks() {
  const unassigned: TaskSummary = { ...eventTask, id: T2, title: '의자 빌리기', assignee: null }
  api.on('GET', `${base}/tasks?view=all&status=open&event=${EVENT_ID}`, () =>
    json({ tasks: [eventTask, unassigned], truncated: false }),
  )
  api.on('GET', `${base}/tasks?view=all&status=done&event=${EVENT_ID}`, () =>
    json({
      tasks: [{ ...eventTask, id: T3, title: '끝난 업무', status: 'done' }],
      truncated: false,
    }),
  )
  api.on('GET', `${base}/tasks?view=unassigned&status=open&event=${EVENT_ID}`, () =>
    json({ tasks: [unassigned], truncated: false }),
  )
}
// 1024px 아래 행사 업무 탭은 끝남 거르기 대신 상태 탭이다(026 조각 4). 수는 읽은 뒤에 붙는다.
const statusTab = (status: string) => screen.findByRole('tab', { name: new RegExp(`^${status}`) })
const tabSelected = (status: string) =>
  statusTab(status).then(tab => tab.getAttribute('aria-selected'))

test('행사 업무 탭에서 고른 끝남은 주소에 남아 새로 고침해도 끝남이고, 기본값을 고르면 주소에서 빠진다', async () => {
  const view = setup(`${EVENT_AT}?tab=tasks`)
  onEventTasks()
  const push = vi.spyOn(window.history, 'pushState')
  fireEvent.click(await statusTab('끝남'))
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=tasks&col=done`))
  expect(await screen.findByRole('button', { name: '끝난 업무' })).toBeTruthy()
  expect(push).not.toHaveBeenCalled()
  view.unmount()
  setup(`${EVENT_AT}?tab=tasks&col=done`)
  onEventTasks()
  expect(await tabSelected('끝남')).toBe('true')
  expect(await screen.findByRole('button', { name: '끝난 업무' })).toBeTruthy()
  fireEvent.click(await statusTab('할 일'))
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=tasks`))
  expect(await tabSelected('할 일')).toBe('true')
})

test('행사 업무 탭에서 보기를 바꿔도 뒤로는 행사에 들어오기 전이다', async () => {
  setup(`/events/${COUNCIL_ID}`)
  onEventTasks()
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('tab', { name: '업무' }))
  fireEvent.click(await statusTab('끝남'))
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=tasks&col=done`))
  act(() => window.history.back())
  await waitFor(() => expect(pathNow()).toBe(`/events/${COUNCIL_ID}`))
  expect(await screen.findByRole('button', { name: '둘째 행사' })).toBeTruthy()
})

test('개요의 담당자 없음 [업무 보기]는 그 거르기가 든 업무 탭 주소로 한 칸 쌓고, 뒤로는 개요다', async () => {
  setup(OVERVIEW_AT)
  onEventTasks()
  const attention = await screen.findByRole('region', { name: '챙길 것' })
  const row = (await within(attention).findAllByRole('listitem')).find(item =>
    within(item).queryByText('담당자 없는 업무'),
  )!
  fireEvent.click(within(row).getByRole('button', { name: '업무 보기' }))
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=tasks&view=unassigned`))
  expect(await screen.findByRole('button', { name: '의자 빌리기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '현수막 주문' })).toBeNull()
  expect(screen.getByRole('button', { name: '필터 해제' })).toBeTruthy()
  // 화면 안의 뒤로도 들어온 곳(개요)의 이름을 단다.
  expect(screen.getByRole('button', { name: '개요' })).toBeTruthy()
  act(() => window.history.back())
  await waitFor(() => expect(pathNow()).toBe(OVERVIEW_AT))
  expect(await selected('개요')).toBe('true')
})

test('행사 업무 탭에서 다른 탭으로 가면 업무 쿼리가 주소에서 빠진다', async () => {
  setup(`${EVENT_AT}?tab=tasks&view=unassigned&col=done`)
  onEventTasks()
  expect(await selected('업무')).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  await waitFor(() => expect(pathNow()).toBe(OVERVIEW_AT))
  fireEvent.click(screen.getByRole('tab', { name: '업무' }))
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=tasks`))
  expect(await tabSelected('할 일')).toBe('true')
  expect(screen.queryByRole('button', { name: '필터 해제' })).toBeNull()
})

test('마지막에 고른 배치는 행사 업무 탭으로 들어갈 때 주소에 실린다', async () => {
  rememberTaskLayout('m1', 'list')
  setup(EVENT_AT)
  onEventTasks()
  fireEvent.click(await screen.findByRole('tab', { name: '업무' }))
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=tasks&layout=list`))
})

// 머리글 경로 줄(DEC-96): 행사 화면은 행사명과 탭 이름을 머리글에 넘긴다.
const pathLine = () =>
  within(within(screen.getByRole('banner')).getByRole('list', { name: '경로' }))
    .getAllByRole('listitem')
    .map(item => item.textContent)

test('행사 업무 탭의 경로 줄은 학생회 > 행사 > 행사명 > 업무이고 제목은 행사명이다', async () => {
  setup(`${EVENT_AT}?tab=tasks`)
  onEventTasks()
  const banner = screen.getByRole('banner')
  expect(
    await within(banner).findByRole('heading', { level: 1, name: '신입생 환영회' }),
  ).toBeTruthy()
  expect(pathLine()).toEqual(['컴퓨터학부 학생회', '행사', '신입생 환영회', '업무'])
  // 행사명은 머리글 제목 하나에만 있다.
  expect(screen.getAllByRole('heading', { name: '신입생 환영회' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  await waitFor(() =>
    expect(pathLine()).toEqual(['컴퓨터학부 학생회', '행사', '신입생 환영회', '구매']),
  )
})

test('행사에서 행사 목록으로 나오면 경로 줄과 제목이 행사 목록의 것이다', async () => {
  setup(EVENT_AT)
  await within(screen.getByRole('banner')).findByRole('heading', { name: '신입생 환영회' })
  fireEvent.click(screen.getAllByRole('button', { name: '전체 행사 보기' })[0]!)
  await waitFor(() => expect(pathLine()).toEqual(['컴퓨터학부 학생회', '행사']))
  expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1 }).textContent).toBe(
    '행사',
  )
})
