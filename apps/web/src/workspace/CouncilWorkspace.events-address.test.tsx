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
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'
import type { Page } from './pages'

const base = `/api/organizations/${COUNCIL_ID}`
const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const EVENT2 = '00000000-0000-4000-8000-0000000000e2'
const EVENT_AT = `/events/${COUNCIL_ID}/${EVENT_ID}`
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
  api.on('GET', `${base}/events/${EVENT_ID}/settlement`, () =>
    json(settlementOf({ remaining: [], settled: true })),
  )
  api.on('GET', `${base}/events/${EVENT_ID}/registration-forms`, () =>
    json({ forms: [], truncated: false, actions: ['form.create'] }),
  )
  const open = () => json({ tasks: [eventTask], truncated: false })
  api.on('GET', `${base}/tasks?view=all&status=open&event=${EVENT_ID}`, open)
  api.on('GET', `${base}/tasks?view=mine&status=open`, open)
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
  expect(await selected('재정')).toBe('true')
  view.unmount()
  setup(`${EVENT_AT}?tab=money`)
  expect(await selected('재정')).toBe('true')
  expect(pathNow()).toBe(`${EVENT_AT}?tab=money`)
})

test('탭을 바꾸면 주소의 쿼리만 바뀌고 기록은 쌓이지 않으며, 개요는 쿼리가 없다', async () => {
  setup(EVENT_AT)
  expect(await selected('개요')).toBe('true')
  const push = vi.spyOn(window.history, 'pushState')
  fireEvent.click(screen.getByRole('tab', { name: '인원 관리' }))
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`))
  expect(await selected('인원 관리')).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  await waitFor(() => expect(pathNow()).toBe(EVENT_AT))
  expect(push).not.toHaveBeenCalled()
})

test('모르는 탭은 개요로 읽고 주소를 고쳐 쓴다', async () => {
  setup(`${EVENT_AT}?tab=nope`)
  expect(await selected('개요')).toBe('true')
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
  fireEvent.click(screen.getByRole('button', { name: '업무' }))
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
  setup(EVENT_AT)
  const next = await screen.findByRole('region', { name: '다음 업무' })
  fireEvent.click(await within(next).findByRole('button', { name: '현수막 주문' }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('현수막 주문')
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}/${T1}`)
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await settle()
  expect(pathNow()).toBe(EVENT_AT)
  expect(await selected('개요')).toBe('true')
})

test('행사의 업무 탭에서 연 업무는 업무 주소로 열리고, 닫으면 그 행사의 업무 탭이다', async () => {
  setup(`${EVENT_AT}?tab=tasks`)
  fireEvent.click(await screen.findByRole('button', { name: '현수막 주문' }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('현수막 주문')
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
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
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
  await waitFor(() => expect(pathNow()).toBe(EVENT_AT))
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
  fireEvent.click(await screen.findByRole('button', { name: '신청 양식 만들기' }))
  await screen.findByRole('form', { name: '신청 양식 만들기' })
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  await waitFor(() => expect(pathNow()).toBe(EVENT_AT))
  expect(screen.queryByText(LEAVE_TITLE)).toBeNull()
})
