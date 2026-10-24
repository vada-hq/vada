// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import {
  EVENT_ID,
  eventDetail,
  eventSummary,
  MEMBER,
  uuidTeam,
} from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { staffForm } from '@/test-support/staff-registration-fixtures'
import { settle } from '@/test-support/settle'
import { EVENT_ERRORS, EVENT_LOST } from '@/lib/messages'
import EventsPage from './EventsPage'
import type { EventTab } from './event-view'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const BASE = '/api/organizations/c1/events'
const OPEN_TASKS = `/api/organizations/c1/tasks?view=all&status=open&event=${EVENT_ID}`
const openTask = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: '현수막 주문',
  status: 'todo',
  dueDate: null,
  overdue: false,
  department: null,
  event: { id: EVENT_ID, name: '신입생 환영회' },
  assignee: null,
  actions: ['task.change_status'],
  ...extra,
})

function setup(
  options: { permissions?: string[]; initialEventId?: string; initialTab?: EventTab } = {},
) {
  const api = mockApi()
  api.on('GET', BASE, () =>
    json({
      events: [
        eventSummary(),
        eventSummary({
          id: 'e2',
          name: '날짜 미정 행사',
          startsAt: null,
          endsAt: null,
          place: null,
          owner: null,
          status: 'tbd',
        }),
      ],
      truncated: false,
    }),
  )
  // 업무 탭의 업무 만들기가 운영진을 읽는다.
  api.on('GET', '/api/organizations/c1/members', () => json(uuidTeam()))
  // 개요가 같이 읽는 세 탭의 요약. 시험마다 바꿔 끼운다.
  api.on('GET', OPEN_TASKS, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${BASE}/${EVENT_ID}/registration-forms`, () =>
    json({ forms: [], truncated: false, actions: [] }),
  )
  api.on('GET', `${BASE}/${EVENT_ID}/settlement`, () =>
    json(settlementOf({ remaining: [], settled: true })),
  )
  const handlers = { onForbidden: vi.fn(), onTasksChanged: vi.fn() }
  const view = councilView('c1', { memberId: MEMBER.m1 })
  if (options.permissions) view.permissions = options.permissions as typeof view.permissions
  render(
    <EventsPage
      view={view}
      initialEventId={options.initialEventId}
      initialTab={options.initialTab}
      {...handlers}
    />,
  )
  return { api, handlers }
}

test('홈에서 연 행사는 정한 탭으로 시작하고, 목록에서 연 다른 행사는 개요로 시작한다', async () => {
  setup({ initialEventId: 'e1', initialTab: 'money' })
  const money = await screen.findByRole('tab', { name: '예산·정산' })
  expect(money.getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '행사 목록' }))
  fireEvent.click(await screen.findByRole('button', { name: '날짜 미정 행사' }))
  const overview = await screen.findByRole('tab', { name: '개요' })
  expect(overview.getAttribute('aria-selected')).toBe('true')
})

test('홈에서 예산·정산 탭으로 연 행사를 닫고 목록에서 다시 열면 개요로 열린다', async () => {
  setup({ initialEventId: EVENT_ID, initialTab: 'money' })
  await screen.findByRole('tab', { name: '예산·정산' })
  fireEvent.click(screen.getByRole('button', { name: '행사 목록' }))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  const overview = await screen.findByRole('tab', { name: '개요' })
  expect(overview.getAttribute('aria-selected')).toBe('true')
})

test('목록 줄에 이름, 일시가 보이고 책임자는 보이지 않으며, 예정과 날짜 미정은 묶음으로 나뉜다', async () => {
  setup()
  const row = (await screen.findByRole('button', { name: '신입생 환영회' })).closest('li')
  expect(row?.textContent).toMatch(/10월 24일 \(토\) 14:00 ~ 18:00/)
  expect(row?.textContent).not.toMatch(/이재정/)
  const coming = screen.getByRole('region', { name: /다가오는 행사/ })
  expect(within(coming).getByRole('button', { name: '신입생 환영회' })).toBeTruthy()
  const tbd = screen.getByRole('region', { name: /날짜 미정/ })
  expect(
    within(tbd).getByRole('button', { name: '날짜 미정 행사' }).closest('li')?.textContent,
  ).not.toMatch(/책임자/)
})

test('[행사 만들기]는 event.create가 있을 때만 보인다', async () => {
  setup({ permissions: ['council.view'] })
  await screen.findByRole('button', { name: '신입생 환영회' })
  expect(screen.queryByRole('button', { name: '행사 만들기' })).toBeNull()
})

// 만들기는 이름 하나만 받는다. 일시·장소는 만든 뒤 상세에서 채운다(notes/frontend-fix-plan.md A4).
async function openCreate() {
  fireEvent.click(await screen.findByRole('button', { name: '행사 만들기' }))
  return screen.findByRole('form', { name: '행사 만들기' })
}

test('만들기는 이름 칸만 있고 이름에 포커스가 가며, 책임자는 없다', async () => {
  setup()
  const form = await openCreate()
  const name = await within(form).findByLabelText('이름')
  expect(document.activeElement).toBe(name)
  expect(within(form).queryByLabelText('시작')).toBeNull()
  expect(within(form).queryByLabelText('장소')).toBeNull()
  expect(within(form).queryByText(/책임자/)).toBeNull()
})

test('만들기는 이름 없이 누르면 보내지 않고 이름 칸 아래에 알리며, 보내는 동안 다시 보내지 않고 이름만 보내고 만든 행사를 연다', async () => {
  const { api } = setup()
  const created = eventDetail({ id: 'e9', name: '봄 축제' })
  let posts = 0
  api.on('POST', BASE, () => {
    posts += 1
    return json({ event: created }, 201)
  })
  api.on('GET', `${BASE}/e9`, () => json({ event: created }))
  const form = await openCreate()
  const submit = within(form).getByRole('button', { name: '만들기' })
  const name = await within(form).findByLabelText('이름')
  fireEvent.click(submit)
  expect(within(form).getByText('이름을 입력해 주세요')).toBeTruthy()
  expect(name.getAttribute('aria-invalid')).toBe('true')
  expect(posts).toBe(0)
  fireEvent.change(name, { target: { value: '봄 축제' } })
  expect(within(form).queryByText('이름을 입력해 주세요')).toBeNull()
  fireEvent.click(submit)
  fireEvent.click(submit)
  await screen.findByRole('heading', { name: '봄 축제' })
  expect(posts).toBe(1)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '봄 축제',
    startsAt: null,
    endsAt: null,
    place: null,
    ownerId: MEMBER.m1,
  })
})

test('만들기 409와 429는 폼 안에 문구로 보이고 대화상자는 열려 있다', async () => {
  const { api } = setup()
  api.on('POST', BASE, () => json({ error: 'MEMBER_INVALID' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '행사 만들기' }))
  fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '행사' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  const form = screen.getByRole('form', { name: '행사 만들기' })
  expect((await within(form).findByRole('alert')).textContent).toBe(EVENT_ERRORS.MEMBER_INVALID)
  api.on('POST', BASE, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() =>
    expect(within(form).getByRole('alert').textContent).toBe(EVENT_ERRORS.TOO_MANY_REQUESTS),
  )
})

test('만들다 권한을 잃으면(403) 학생회를 다시 읽게 하고 이유를 목록 위에 보인다', async () => {
  const { api, handlers } = setup()
  api.on('POST', BASE, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(await screen.findByRole('button', { name: '행사 만들기' }))
  fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '행사' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/권한이 바뀌었어요/)
})

test('행사를 열면 머리에 일시·장소가, 개요에 세 탭의 수가 보이고 이력은 없으며, 버튼은 actions대로만 보인다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', `${BASE}/${EVENT_ID}/registration-forms`, () =>
    json({
      forms: [staffForm({ applicantCount: 42, attendedCount: 5, capacity: 60 })],
      truncated: false,
      actions: [],
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  const tasks = await screen.findByRole('region', { name: '업무' })
  expect(within(tasks).getByText('1/3')).toBeTruthy()
  expect(within(tasks).getByRole('progressbar', { name: '끝난 업무' })).toHaveProperty('value', 1)
  expect(await screen.findByText('42명')).toBeTruthy()
  expect(screen.getByText('정원 60명 · 출석 5명')).toBeTruthy()
  expect(await screen.findByText('36,000원')).toBeTruthy()
  const money = screen.getByRole('region', { name: '지출' })
  expect(within(money).getByText('36,000원')).toBeTruthy()
  expect(screen.getByText('대강당')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '이력' })).toBeNull()
  expect(screen.queryByRole('region', { name: '챙길 것' })).toBeNull()
  expect(screen.queryByText(/책임자/)).toBeNull()
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
})

test('개요의 지출 카드에서 [예산·정산 보기]를 누르면 예산·정산 탭이 열린다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  const money = await screen.findByRole('region', { name: '지출' })
  fireEvent.click(within(money).getByRole('button', { name: '예산·정산 보기' }))
  expect(screen.getByRole('tab', { name: '예산·정산' }).getAttribute('aria-selected')).toBe('true')
})

test('고치면 칸을 그대로 보내고 응답이 화면 값이 되며 목록을 다시 읽는다', async () => {
  const { api } = setup()
  const reads = () => api.calls.filter(call => call.method === 'GET' && call.path === BASE).length
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail({}, ['event.update']) }))
  api.on('POST', `${BASE}/${EVENT_ID}`, () =>
    json({ event: eventDetail({ name: '신입생 환영회(수정)' }, ['event.update']) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const before = reads()
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '신입생 환영회(수정)' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('heading', { name: '신입생 환영회(수정)' })).toBeTruthy()
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '신입생 환영회(수정)',
    startsAt: '2026-10-24T14:00',
    endsAt: '2026-10-24T18:00',
    place: '대강당',
  })
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
})

test('빈 일시·장소는 고칠 수 있을 때 [넣기] 버튼이고, 누르면 고치기가 그 칸에 포커스를 두고 열린다', async () => {
  const { api } = setup()
  const empty = eventDetail({ startsAt: null, endsAt: null, place: null, status: 'tbd' }, [
    'event.update',
  ])
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: empty }))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('button', { name: '장소 넣기' }))
  const dialog = await screen.findByRole('dialog', { name: '행사 고치기' })
  expect(document.activeElement).toBe(within(dialog).getByLabelText('장소'))
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  // 머리의 [일시 넣기]. 준비 단계에도 같은 링크가 있다.
  fireEvent.click(screen.getAllByRole('button', { name: '일시 넣기' })[0]!)
  const again = await screen.findByRole('dialog', { name: '행사 고치기' })
  expect(document.activeElement).toBe(within(again).getByLabelText('시작'))
})

test('챙길 것은 지난 업무와 담당자 없는 업무를 보이고, [업무 보기]는 업무 탭으로 옮긴다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', OPEN_TASKS, () =>
    json({
      tasks: [
        openTask('t1', { overdue: true, dueDate: '2026-10-20' }),
        openTask('t2', { title: '의자 빌리기' }),
      ],
      truncated: false,
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  const attention = await screen.findByRole('region', { name: '챙길 것' })
  expect(within(attention).getByText('마감이 지난 업무')).toBeTruthy()
  expect(within(attention).getByText('현수막 주문 · 의자 빌리기')).toBeTruthy()
  fireEvent.click(within(attention).getAllByRole('button', { name: '업무 보기' })[0]!)
  expect(screen.getByRole('tab', { name: '업무' }).getAttribute('aria-selected')).toBe('true')
  await settle()
})

test('다음 업무의 제목을 누르면 업무 탭에서 그 업무가 열린다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', OPEN_TASKS, () => json({ tasks: [openTask('t1')], truncated: false }))
  api.on('GET', '/api/organizations/c1/tasks/t1', () =>
    json({ task: taskDetail({ event: { id: EVENT_ID, name: '신입생 환영회' } }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  const next = await screen.findByRole('region', { name: '다음 업무' })
  fireEvent.click(await within(next).findByRole('button', { name: '현수막 주문' }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
  // 열린 대화상자 밖은 화면 낭독기에서 숨으므로 숨은 것까지 찾는다.
  const tab = screen.getByRole('tab', { name: '업무', hidden: true })
  expect(tab.getAttribute('aria-selected')).toBe('true')
})

test('업무도 신청도 돈도 없는 새 행사는 수 카드 대신 준비 단계를 보이고, [업무 만들기]는 업무 탭에서 만들기를 연다', async () => {
  const { api } = setup()
  const blank = eventDetail(
    { startsAt: null, endsAt: null, place: null, status: 'tbd', tasks: { open: 0, total: 0 } },
    ['event.update'],
  )
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: blank }))
  api.on('GET', `${BASE}/${EVENT_ID}/settlement`, () =>
    json(
      settlementOf({
        budget: { expense: 0, income: 0, items: [] },
        actual: { expense: 0, fee: 0, income: 0, depositCount: 0, refundPendingCount: 0 },
        remaining: [],
      }),
    ),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  const steps = await screen.findByRole('region', { name: '준비 시작하기' })
  expect(within(steps).getByText('4단계 중 0단계 끝남')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '업무' })).toBeNull()
  expect(screen.queryByRole('region', { name: '다음 업무' })).toBeNull()
  expect(within(steps).queryByRole('button', { name: '신청 양식 만들기' })).toBeNull()
  fireEvent.click(within(steps).getByRole('button', { name: '업무 만들기' }))
  expect(await screen.findByRole('dialog', { name: '업무 만들기' })).toBeTruthy()
  await settle()
})

test('고칠 수 없으면 빈 칸은 글자로만 보인다', async () => {
  const { api } = setup()
  const empty = eventDetail({ startsAt: null, endsAt: null, place: null, status: 'tbd' })
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: empty }))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  expect(await screen.findByText('장소 없음')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '장소 넣기' })).toBeNull()
})

test('고치기에서 끝이 시작보다 이르면 저장을 눌러도 보내지 않고 끝 칸 아래에 알리며 그 칸으로 옮긴다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail({}, ['event.update']) }))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const end = screen.getByLabelText('끝')
  fireEvent.change(end, { target: { value: '2026-10-24T13:00' } })
  const save = screen.getByRole('button', { name: '저장' })
  expect(save).toHaveProperty('disabled', false)
  fireEvent.click(save)
  expect(screen.getByText('시작보다 늦은 시각을 입력해 주세요')).toBeTruthy()
  expect(end.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(end))
  expect(api.calls.some(call => call.method !== 'GET')).toBe(false)
})

test('고치기에서 시작 없이 끝만 넣고 저장을 누르면 보내지 않고 시작을 넣으라고 보인다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () =>
    json({ event: eventDetail({ startsAt: null, endsAt: null }, ['event.update']) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  fireEvent.change(screen.getByLabelText('끝'), { target: { value: '2026-10-24T13:00' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.getByText('시작을 입력해 주세요')).toBeTruthy()
  expect(screen.getByLabelText('시작').getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method !== 'GET')).toBe(false)
})

test('열린 행사가 사라지면(404) 목록으로 돌아가 이유를 보인다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  expect((await screen.findByRole('alert')).textContent).toBe(EVENT_LOST)
  expect(screen.getByRole('button', { name: '날짜 미정 행사' })).toBeTruthy()
})

test('업무 탭은 그 행사의 업무만 읽고, 만들면 그 행사에 이어진다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', `/api/organizations/c1/tasks?view=all&status=open&event=${EVENT_ID}`, () =>
    json({
      tasks: [
        {
          id: 't1',
          title: '현수막 주문',
          status: 'todo',
          dueDate: null,
          overdue: false,
          department: null,
          event: { id: EVENT_ID, name: '신입생 환영회' },
          assignee: null,
          actions: ['task.change_status'],
        },
      ],
      truncated: false,
    }),
  )
  api.on('POST', '/api/organizations/c1/tasks', () => json({ error: 'EVENT_INVALID' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('tab', { name: '업무' }))
  await screen.findByRole('button', { name: '현수막 주문' })
  expect(screen.queryByRole('tab', { name: '내 업무' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '업무 만들기' }))
  await screen.findByRole('combobox', { name: '담당 부서' })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청소' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() =>
    expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
      eventId: EVENT_ID,
    }),
  )
  await settle()
})

test.each([
  [403, /권한이 바뀌었어요/],
  [404, new RegExp(EVENT_LOST)],
])('고치다가 %i이면 대화상자를 닫고 이유를 보인다', async (status, message) => {
  const { api, handlers } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail({}, ['event.update']) }))
  api.on('POST', `${BASE}/${EVENT_ID}`, () => json({ error: 'X' }, status))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '새 이름' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(message)
  if (status === 403) expect(handlers.onForbidden).toHaveBeenCalled()
})

test('대화상자가 열린 채 다시 읽은 actions에서 권한이 빠지면 닫고 이유를 보인다', async () => {
  const { api } = setup()
  let actions: 'event.update'[] = ['event.update']
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail({}, actions) }))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  actions = []
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/권한이 바뀌었어요/)
})

test('업무 탭에서 업무를 만들면 행사 상세도 다시 읽는다', async () => {
  const { api } = setup()
  const detailPath = `${BASE}/${EVENT_ID}`
  api.on('GET', detailPath, () => json({ event: eventDetail() }))
  api.on('GET', `/api/organizations/c1/tasks?view=all&status=open&event=${EVENT_ID}`, () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('POST', '/api/organizations/c1/tasks', () => json({ task: taskDetail() }, 201))
  const reads = () => api.calls.filter(call => call.path === detailPath).length
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('tab', { name: '업무' }))
  fireEvent.click(await screen.findByRole('button', { name: '업무 만들기' }))
  await screen.findByRole('combobox', { name: '담당 부서' })
  const before = reads()
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청소' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
})
