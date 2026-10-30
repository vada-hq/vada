// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { EVENT_NAME_MAX } from '@vada/contracts'
import { openHistory } from '@/test-support/history'
import { councilView } from '@/test-support/council-fixtures'
import {
  EVENT_ID,
  eventDetail,
  eventSummary,
  MEMBER,
  uuidTeam,
} from '@/test-support/event-fixtures'
import {
  expectAsksOnEveryExit,
  expectClosesQuietly,
  leaveWindow,
  showLeaveConfirm,
} from '@/test-support/leave-window'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { staffForm } from '@/test-support/staff-registration-fixtures'
import { settle } from '@/test-support/settle'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { serveEventRooms, WithChat } from '@/test-support/event-rooms'
import { hasUnsavedInput } from '@/lib/leave-guard'
import { ADDRESS_LOST, EVENT_ERRORS } from '@/lib/messages'
import EventsPage from './EventsPage'
import { pickDateTime } from '@/test-support/date-field'

// 주소는 uuid여야 읽히므로 행사 시험은 이 학생회와 행사 번호를 쓴다.
const EVENT2 = '00000000-0000-4000-8000-0000000000e2'
const EVENT9 = '00000000-0000-4000-8000-0000000000e9'
const TASK_ID = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const LIST_AT = `/events/${COUNCIL_ID}`
const pathNow = () => window.location.pathname + window.location.search

beforeEach(() => {
  window.history.replaceState(null, '', LIST_AT)
})
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const BASE = `/api/organizations/${COUNCIL_ID}/events`
const OPEN_TASKS = `/api/organizations/${COUNCIL_ID}/tasks?view=all&status=open&event=${EVENT_ID}`
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

function setup(options: { permissions?: string[]; at?: string } = {}) {
  const api = mockApi()
  api.on(
    'GET',
    `/api/organizations/${COUNCIL_ID}/purchase-requests?view=all&event=${EVENT_ID}`,
    () =>
      json({
        requests: [],
        truncated: false,
        stageCounts: { pending: 0, unpaid: 0, paid: 0, closed: 0 },
      }),
  )
  api.on('GET', BASE, () =>
    json({
      events: [
        eventSummary(),
        eventSummary({
          id: EVENT2,
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
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(uuidTeam()))
  // 업무 탭의 빠른 추가가 그 행사의 만들기 선택지를 읽는다.
  api.on('GET', `/api/organizations/${COUNCIL_ID}/tasks/options?event=${EVENT_ID}`, () =>
    json({ departments: [{ id: null, name: null, assignees: [{ id: null, name: null }] }] }),
  )
  // 개요가 같이 읽는 세 탭의 요약. 시험마다 바꿔 끼운다.
  api.on('GET', OPEN_TASKS, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${BASE}/${EVENT_ID}/registration-forms`, () =>
    json({ forms: [], truncated: false, actions: [] }),
  )
  api.on('GET', `${BASE}/${EVENT_ID}/settlement`, () =>
    json(settlementOf({ remaining: [], settled: true })),
  )
  serveEventRooms(api, COUNCIL_ID, EVENT_ID)
  serveEventRooms(api, COUNCIL_ID, EVENT2)
  const handlers = { onForbidden: vi.fn(), onTasksChanged: vi.fn() }
  const view = councilView(COUNCIL_ID, { memberId: MEMBER.m1 })
  if (options.permissions) view.permissions = options.permissions as typeof view.permissions
  window.history.replaceState(null, '', options.at ?? LIST_AT)
  render(
    <WithChat councilId={COUNCIL_ID}>
      {chat => <EventsPage view={view} {...handlers} {...chat} />}
    </WithChat>,
  )
  return { api, handlers }
}

test('홈에서 정한 탭으로 연 행사는 그 탭으로 시작하고, 목록에서 다시 연 행사는 메시지로 시작한다', async () => {
  setup({ at: `${LIST_AT}/${EVENT_ID}?tab=money` })
  const money = await screen.findByRole('tab', { name: '구매' })
  expect(money.getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '행사 목록' }))
  fireEvent.click(await screen.findByRole('button', { name: '날짜 미정 행사' }))
  const messages = await screen.findByRole('tab', { name: '메시지' })
  expect(messages.getAttribute('aria-selected')).toBe('true')
  expect(pathNow()).toBe(`${LIST_AT}/${EVENT2}`)
})

test('카드에 상태, 일시, 장소, 담당, 신청·업무·남은 정리 수와 마지막 수정이 보인다', async () => {
  setup()
  const row = (await screen.findByRole('button', { name: '신입생 환영회' })).closest('li')
  expect(row?.textContent).toMatch(/10월 24일 \(토\) 14:00 ~ 18:00/)
  expect(row?.textContent).toContain('담당 기획부 · 이재정')
  expect(row?.textContent).toContain('신청 4명')
  expect(row?.textContent).toContain('업무 3개')
  expect(row?.textContent).toContain('끝나지 않은 업무 2건')
  expect(row?.textContent).toContain('정산에 남은 것 1건')
  expect(row?.textContent).toContain('마지막 수정')
  const tbd = screen.getByRole('button', { name: '날짜 미정 행사' }).closest('li')!
  expect(tbd.textContent).toContain('장소 미정')
  expect(tbd.textContent).toContain('미정')
})

test('행사명 찾기와 상태 칩은 함께 거르고 결과 없음은 행사 없음과 다르다', async () => {
  setup()
  await screen.findByRole('button', { name: '신입생 환영회' })
  fireEvent.change(screen.getByRole('searchbox', { name: '행사명 찾기' }), {
    target: { value: '  미정  ' },
  })
  expect(screen.queryByRole('button', { name: '신입생 환영회' })).toBeNull()
  expect(screen.getByRole('button', { name: '날짜 미정 행사' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '진행 중' }))
  expect(screen.getByText('결과 없음')).toBeTruthy()
  expect(screen.queryByText('행사 없음')).toBeNull()
  expect(screen.getAllByRole('button', { name: '새 행사' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '기획 중' }))
  expect(screen.getByRole('button', { name: '날짜 미정 행사' })).toBeTruthy()
  fireEvent.change(screen.getByRole('searchbox', { name: '행사명 찾기' }), {
    target: { value: '' },
  })
  expect(screen.getByRole('button', { name: '신입생 환영회' })).toBeTruthy()
})

test('긴 행사명은 카드를 떠나지 않고 전체 이름을 펼치고 접는다', async () => {
  const { api } = setup()
  await screen.findByText('날짜 미정 행사')
  const name = '소프트웨어융합대학 체육대회 준비와 참가자 명단 확인을 위한 긴 행사 이름'
  api.on('GET', BASE, () => json({ events: [eventSummary({ name })], truncated: false }))
  document.dispatchEvent(new Event('visibilitychange'))
  await screen.findByRole('button', { name })
  const expand = screen.getByRole('button', { name: '전체 이름 보기' })
  expect(expand.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(expand)
  expect(screen.getByRole('button', { name: '이름 접기' }).getAttribute('aria-expanded')).toBe(
    'true',
  )
  expect(pathNow()).toBe(LIST_AT)
  fireEvent.click(screen.getByRole('button', { name: '이름 접기' }))
  expect(screen.getByRole('button', { name: '전체 이름 보기' })).toBeTruthy()
})

test('정렬 기본값은 행사 일시순이고 최근 활동순은 마지막 수정이 최신인 카드부터 보인다', async () => {
  const { api } = setup()
  await screen.findByText('날짜 미정 행사')
  api.on('GET', BASE, () =>
    json({
      events: [
        {
          ...eventSummary(),
          departments: [],
          tasks: { open: 0, total: 0 },
          applicantCount: 0,
          remaining: 0,
          updatedAt: '2026-10-20T10:00:00Z',
        },
        {
          ...eventSummary({ id: EVENT2, name: '완료 행사', status: 'completed' }),
          departments: [],
          tasks: { open: 0, total: 0 },
          applicantCount: 0,
          remaining: 0,
          updatedAt: '2026-10-25T10:00:00Z',
        },
      ],
      truncated: false,
    }),
  )
  document.dispatchEvent(new Event('visibilitychange'))
  await screen.findByRole('button', { name: '완료 행사' })
  const names = () =>
    screen.getAllByRole('listitem').map(item => within(item).getByRole('button').textContent)
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '정렬' }).value).toBe('date')
  expect(names()).toEqual(['신입생 환영회', '완료 행사'])
  fireEvent.change(screen.getByRole('combobox', { name: '정렬' }), {
    target: { value: 'activity' },
  })
  expect(names()).toEqual(['완료 행사', '신입생 환영회'])
  fireEvent.click(screen.getByRole('button', { name: '완료' }))
  expect(names()).toEqual(['완료 행사'])
  expect(screen.getByText('신청 0명').className).toContain('text-fg-muted')
  expect(screen.getByText('업무 0개')).toBeTruthy()
})

test('[새 행사]는 event.create가 있을 때만 보인다', async () => {
  setup({ permissions: ['council.view'] })
  await screen.findByRole('button', { name: '신입생 환영회' })
  expect(screen.queryByRole('button', { name: '새 행사' })).toBeNull()
})

// 목록에서 행사를 열고 개요 탭으로 옮긴다. 행사는 메시지 탭으로 열린다(022 정한 것 28).
async function openOverview() {
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  fireEvent.click(await screen.findByRole('tab', { name: '개요' }))
}

// 만들기는 이름 하나만 받는다. 일시·장소는 만든 뒤 상세에서 채운다(notes/frontend-fix-plan.md A4).
async function openCreate() {
  fireEvent.click(await screen.findByRole('button', { name: '새 행사' }))
  return screen.findByRole('form', { name: '새 행사' })
}

test('만들기는 이름 칸만 있고 이름에 포커스가 가며, 책임자는 없다', async () => {
  setup()
  const form = await openCreate()
  const name = await within(form).findByLabelText('행사명')
  expect(document.activeElement).toBe(name)
  expect(within(form).queryByLabelText('시작 일시')).toBeNull()
  expect(within(form).queryByLabelText('장소')).toBeNull()
  expect(within(form).queryByText(/책임자/)).toBeNull()
})

test('새 행사 창은 쓴 값이 있으면 닫는 길마다 묻고, 없으면 묻지 않는다', async () => {
  setup()
  showLeaveConfirm()
  await openCreate()
  await expectClosesQuietly('새 행사')
  const form = await openCreate()
  fireEvent.change(within(form).getByLabelText('행사명'), { target: { value: '봄 축제' } })
  await expectAsksOnEveryExit('새 행사')
  expect(within(form).getByLabelText('행사명')).toHaveProperty('value', '봄 축제')
  await leaveWindow('새 행사')
})

test('새 행사를 보내는 중에는 새로고침 확인을 걸지 않고, 실패하면 다시 건다', async () => {
  const { api } = setup()
  const pending = deferredResponse()
  api.on('POST', BASE, () => pending.promise)
  const form = await openCreate()
  fireEvent.change(within(form).getByLabelText('행사명'), { target: { value: '봄 축제' } })
  expect(hasUnsavedInput()).toBe(true)
  fireEvent.click(within(form).getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(api.calls.some(call => call.method === 'POST')).toBe(true))
  await waitFor(() => expect(hasUnsavedInput()).toBe(false))
  pending.resolve(json({ error: 'FAILED' }, 500))
  await waitFor(() => expect(hasUnsavedInput()).toBe(true))
})

test('만들기는 이름 없이 누르면 보내지 않고 이름 칸 아래에 알리며, 보내는 동안 다시 보내지 않고 이름만 보내고 만든 행사의 개요를 연다', async () => {
  const { api } = setup()
  const created = eventDetail({ id: EVENT9, name: '봄 축제' })
  let posts = 0
  api.on('POST', BASE, () => {
    posts += 1
    return json({ event: created }, 201)
  })
  api.on('GET', `${BASE}/${EVENT9}`, () => json({ event: created }))
  serveEventRooms(api, COUNCIL_ID, EVENT9)
  api.on('GET', `/api/organizations/${COUNCIL_ID}/tasks?view=all&status=open&event=${EVENT9}`, () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('GET', `${BASE}/${EVENT9}/registration-forms`, () =>
    json({ forms: [], truncated: false, actions: [] }),
  )
  api.on('GET', `${BASE}/${EVENT9}/settlement`, () => json(settlementOf()))
  const form = await openCreate()
  const submit = within(form).getByRole('button', { name: '만들기' })
  const name = await within(form).findByLabelText('행사명')
  fireEvent.click(submit)
  expect(within(form).getByText('행사명을 입력해 주세요')).toBeTruthy()
  expect(name.getAttribute('aria-invalid')).toBe('true')
  expect(posts).toBe(0)
  fireEvent.change(name, { target: { value: '봄 축제' } })
  expect(within(form).queryByText('행사명을 입력해 주세요')).toBeNull()
  fireEvent.click(submit)
  fireEvent.click(submit)
  await screen.findByRole('heading', { name: '봄 축제' })
  expect(pathNow()).toBe(`${LIST_AT}/${EVENT9}?tab=overview`)
  expect(screen.getByRole('tab', { name: '개요', selected: true })).toBeTruthy()
  expect(posts).toBe(1)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '봄 축제',
    startsAt: null,
    endsAt: null,
    place: null,
  })
})

test('만들기 409와 429는 폼 안에 문구로 보이고 대화상자는 열려 있다', async () => {
  const { api } = setup()
  api.on('POST', BASE, () => json({ error: 'TASK_INVALID' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '새 행사' }))
  fireEvent.change(await screen.findByLabelText('행사명'), { target: { value: '행사' } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  const form = screen.getByRole('form', { name: '새 행사' })
  expect((await within(form).findByRole('alert')).textContent).toBe(EVENT_ERRORS.TASK_INVALID)
  api.on('POST', BASE, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() =>
    expect(within(form).getByRole('alert').textContent).toBe(EVENT_ERRORS.TOO_MANY_REQUESTS),
  )
})

test('만들다 권한을 잃으면(403) 학생회를 다시 읽게 하고 이유를 목록 위에 보인다', async () => {
  const { api, handlers } = setup()
  api.on('POST', BASE, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(await screen.findByRole('button', { name: '새 행사' }))
  fireEvent.change(await screen.findByLabelText('행사명'), { target: { value: '행사' } })
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
  await openOverview()
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
  expect(screen.queryByRole('button', { name: '기본정보 수정' })).toBeNull()
  // 이력은 '⋯' 메뉴 뒤에 있고 읽는 사람 모두에게 보인다.
  const history = await openHistory()
  expect(within(history).getByText('김회장 · 10월 20일 14:03 · 만듦')).toBeTruthy()
})

test('개요의 지출 카드에서 [구매 보기]를 누르면 구매 탭이 열린다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  await openOverview()
  const money = await screen.findByRole('region', { name: '지출' })
  fireEvent.click(within(money).getByRole('button', { name: '구매 보기' }))
  expect(screen.getByRole('tab', { name: '구매' }).getAttribute('aria-selected')).toBe('true')
})

test.each([
  ['정산에 남은 것', false],
  ['정산이 끝났어요', true],
] as const)(
  '개요의 %s에서 [구매 보기]를 누르면 같은 money 주소로 간다',
  async (title, completed) => {
    const { api } = setup()
    api.on('GET', `${BASE}/${EVENT_ID}`, () =>
      json({
        event: eventDetail({ status: 'ended' }, completed ? ['event.complete'] : []),
      }),
    )
    api.on('GET', `${BASE}/${EVENT_ID}/settlement`, () =>
      json(completed ? settlementOf({ remaining: [], settled: true }) : settlementOf()),
    )
    await openOverview()
    const attention = await screen.findByRole('region', { name: '챙길 것' })
    expect(within(attention).getByText(title)).toBeTruthy()
    fireEvent.click(within(attention).getByRole('button', { name: '구매 보기' }))
    expect(pathNow()).toBe(`${LIST_AT}/${EVENT_ID}?tab=money`)
    expect(screen.getByRole('tab', { name: '구매', selected: true })).toBeTruthy()
  },
)

test('고치면 칸을 그대로 보내고 응답이 화면 값이 되며 목록을 다시 읽는다', async () => {
  const { api } = setup()
  const reads = () => api.calls.filter(call => call.method === 'GET' && call.path === BASE).length
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail({}, ['event.update']) }))
  api.on('POST', `${BASE}/${EVENT_ID}`, () =>
    json({ event: eventDetail({ name: '신입생 환영회(수정)' }, ['event.update']) }),
  )
  await openOverview()
  fireEvent.click(await screen.findByRole('button', { name: '기본정보 수정' }))
  const before = reads()
  fireEvent.change(screen.getByLabelText('행사명'), { target: { value: '신입생 환영회(수정)' } })
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

test('빈 일시·장소는 머리에 미정으로 보이고, 준비 단계의 [일시 넣기]는 고치기를 그 칸에 포커스를 두고 연다', async () => {
  const { api } = setup()
  const empty = eventDetail({ startsAt: null, endsAt: null, place: null, status: 'tbd' }, [
    'event.update',
  ])
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: empty }))
  await openOverview()
  const bar = await screen.findByRole('group', { name: '행사 요약' })
  expect(bar.textContent).toContain('일시 미정')
  expect(bar.textContent).toContain('장소 미정')
  expect(within(bar).queryByRole('button', { name: '일시 넣기' })).toBeNull()
  fireEvent.click(await screen.findByRole('button', { name: '일시 넣기' }))
  const dialog = await screen.findByRole('dialog', { name: '행사 기본정보 수정' })
  expect(document.activeElement).toBe(within(dialog).getByLabelText('시작 일시'))
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
  await openOverview()
  const attention = await screen.findByRole('region', { name: '챙길 것' })
  expect(within(attention).getByText('마감이 지난 업무')).toBeTruthy()
  expect(within(attention).getByText('현수막 주문 · 의자 빌리기')).toBeTruthy()
  fireEvent.click(within(attention).getAllByRole('button', { name: '업무 보기' })[0]!)
  expect(screen.getByRole('tab', { name: '업무' }).getAttribute('aria-selected')).toBe('true')
  await settle()
})

test('챙길 것의 담당자 없음 [업무 보기]는 업무 탭을 담당자 없는 업무만 보이는 보기로 열고, 풀면 전체로 돌아온다', async () => {
  const { api } = setup()
  const unassigned = `/api/organizations/${COUNCIL_ID}/tasks?view=unassigned&status=open&event=${EVENT_ID}`
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', OPEN_TASKS, () =>
    json({
      tasks: [
        openTask('t1', { assignee: { id: 'p1', name: '김새내', current: true } }),
        openTask('t2', { title: '의자 빌리기' }),
      ],
      truncated: false,
    }),
  )
  api.on('GET', unassigned, () =>
    json({ tasks: [openTask('t2', { title: '의자 빌리기' })], truncated: false }),
  )
  await openOverview()
  const attention = await screen.findByRole('region', { name: '챙길 것' })
  const rows = within(attention).getAllByRole('listitem')
  const row = rows.find(item => within(item).queryByText('담당자 없는 업무'))!
  fireEvent.click(within(row).getByRole('button', { name: '업무 보기' }))
  expect(await screen.findByRole('button', { name: '의자 빌리기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '현수막 주문' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '필터 해제' }))
  expect(await screen.findByRole('button', { name: '현수막 주문' })).toBeTruthy()
  await settle()
})

test('다음 업무의 제목을 누르면 그 업무가 업무 주소로 열린다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', OPEN_TASKS, () => json({ tasks: [openTask(TASK_ID)], truncated: false }))
  await openOverview()
  const next = await screen.findByRole('region', { name: '다음 업무' })
  fireEvent.click(await within(next).findByRole('button', { name: '현수막 주문' }))
  expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}/${TASK_ID}`)
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
  await openOverview()
  const steps = await screen.findByRole('region', { name: '준비 시작하기' })
  expect(within(steps).queryByText(/단계 중/)).toBeNull()
  expect(screen.queryByRole('region', { name: '업무' })).toBeNull()
  expect(screen.queryByRole('region', { name: '다음 업무' })).toBeNull()
  expect(within(steps).queryByRole('button', { name: '신청 양식 만들기' })).toBeNull()
  fireEvent.click(within(steps).getByRole('button', { name: '구매 보기' }))
  expect(pathNow()).toBe(`${LIST_AT}/${EVENT_ID}?tab=money`)
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  const restoredSteps = await screen.findByRole('region', { name: '준비 시작하기' })
  fireEvent.click(within(restoredSteps).getByRole('button', { name: '업무 만들기' }))
  const quickAdd = await screen.findByRole('textbox', { name: '새 업무' })
  expect(document.activeElement).toBe(quickAdd)
  await settle()
})

test('고칠 수 없으면 빈 칸은 미정으로만 보이고 [기본정보 수정]이 없다', async () => {
  const { api } = setup()
  const empty = eventDetail({ startsAt: null, endsAt: null, place: null, status: 'tbd' })
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: empty }))
  await openOverview()
  expect(await screen.findByText('장소 미정')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '기본정보 수정' })).toBeNull()
})

test('고치기에서 끝이 시작보다 이르면 저장을 눌러도 보내지 않고 끝 칸 아래에 알리며 그 칸으로 옮긴다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail({}, ['event.update']) }))
  await openOverview()
  fireEvent.click(await screen.findByRole('button', { name: '기본정보 수정' }))
  const end = screen.getByLabelText('종료 일시')
  await pickDateTime(end, '2026-10-24T13:00')
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
  await openOverview()
  fireEvent.click(await screen.findByRole('button', { name: '기본정보 수정' }))
  // 비어 있는 끝은 '종료 시간 미정' 체크로 열린다. 풀어야 칸이 켜진다.
  fireEvent.click(screen.getByRole('checkbox', { name: '종료 시간 미정' }))
  await pickDateTime(screen.getByLabelText('종료 일시'), '2026-10-24T13:00')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.getByText('시작 일시를 입력해 주세요')).toBeTruthy()
  expect(screen.getByLabelText('시작 일시').getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method !== 'GET')).toBe(false)
})

test('열린 행사가 사라지면(404) 찾을 수 없음을 보이고 행사 목록으로 가는 버튼이 있다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ error: 'NOT_FOUND' }, 404))
  await openOverview()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '행사 목록' }))
  expect(await screen.findByRole('button', { name: '날짜 미정 행사' })).toBeTruthy()
  expect(pathNow()).toBe(LIST_AT)
})

test('업무 탭은 그 행사의 업무만 읽고, 만들면 그 행사에 이어진다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on(
    'GET',
    `/api/organizations/${COUNCIL_ID}/tasks?view=all&status=open&event=${EVENT_ID}`,
    () =>
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
  api.on('POST', `/api/organizations/${COUNCIL_ID}/tasks`, () =>
    json({ error: 'EVENT_INVALID' }, 409),
  )
  await openOverview()
  fireEvent.click(await screen.findByRole('tab', { name: '업무' }))
  await screen.findByRole('button', { name: '현수막 주문' })
  expect(screen.queryByRole('tab', { name: '내 업무' })).toBeNull()
  expect(screen.queryByRole('button', { name: '업무 만들기' })).toBeNull()
  fireEvent.change(await screen.findByRole('textbox', { name: '새 업무' }), {
    target: { value: '청소' },
  })
  await settle()
  fireEvent.click(screen.getByRole('button', { name: '추가' }))
  await waitFor(() =>
    expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
      eventId: EVENT_ID,
    }),
  )
  await settle()
})

test.each([403, 404])('고치다가 %i이면 대화상자를 닫고 찾을 수 없음을 보인다', async status => {
  const { api, handlers } = setup()
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail({}, ['event.update']) }))
  api.on('POST', `${BASE}/${EVENT_ID}`, () => json({ error: 'X' }, status))
  await openOverview()
  fireEvent.click(await screen.findByRole('button', { name: '기본정보 수정' }))
  fireEvent.change(screen.getByLabelText('행사명'), { target: { value: '새 이름' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  if (status === 403) expect(handlers.onForbidden).toHaveBeenCalled()
})

test('대화상자가 열린 채 다시 읽은 actions에서 권한이 빠지면 닫고 이유를 보인다', async () => {
  const { api } = setup()
  let actions: 'event.update'[] = ['event.update']
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event: eventDetail({}, actions) }))
  await openOverview()
  fireEvent.click(await screen.findByRole('button', { name: '기본정보 수정' }))
  actions = []
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/권한이 바뀌었어요/)
})

test('업무 탭에서 업무를 만들면 행사 상세도 다시 읽는다', async () => {
  const { api } = setup()
  const detailPath = `${BASE}/${EVENT_ID}`
  api.on('GET', detailPath, () => json({ event: eventDetail() }))
  api.on(
    'GET',
    `/api/organizations/${COUNCIL_ID}/tasks?view=all&status=open&event=${EVENT_ID}`,
    () => json({ tasks: [], truncated: false }),
  )
  api.on('POST', `/api/organizations/${COUNCIL_ID}/tasks`, () => json({ task: taskDetail() }, 201))
  const reads = () => api.calls.filter(call => call.path === detailPath).length
  await openOverview()
  fireEvent.click(await screen.findByRole('tab', { name: '업무' }))
  const input = await screen.findByRole('textbox', { name: '새 업무' })
  await settle()
  const before = reads()
  fireEvent.change(input, { target: { value: '청소' } })
  fireEvent.click(screen.getByRole('button', { name: '추가' }))
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
})

test('행사가 없으면 빈 화면에서 새 행사를 만들고, 만들 수 없는 사람에게는 담당만 알린다', async () => {
  const { api } = setup()
  await screen.findByText('날짜 미정 행사')
  api.on('GET', BASE, () => json({ events: [], truncated: false }))
  document.dispatchEvent(new Event('visibilitychange'))
  const title = await screen.findByText('행사 없음')
  const empty = title.parentElement!
  const icon = empty.querySelector('svg.lucide-calendar-days')
  expect(icon?.getAttribute('aria-hidden')).toBe('true')
  expect(icon?.parentElement?.classList.contains('rounded-full')).toBe(true)
  expect(icon?.parentElement?.classList.contains('bg-surface-muted')).toBe(true)
  const create = screen.getByRole('button', { name: '새 행사' })
  expect(empty.contains(create)).toBe(true)
  expect([...empty.children].indexOf(title)).toBeLessThan(
    [...empty.children].indexOf(create.parentElement!),
  )
  expect(screen.queryByText('회장단과 부서장이 만들어요')).toBeNull()
  fireEvent.click(create)
  expect(await screen.findByRole('dialog')).toBeTruthy()
  cleanup()
  const member = setup({ permissions: [] })
  await screen.findByText('날짜 미정 행사')
  member.api.on('GET', BASE, () => json({ events: [], truncated: false }))
  document.dispatchEvent(new Event('visibilitychange'))
  const memberTitle = await screen.findByText('행사 없음')
  const memberEmpty = memberTitle.parentElement!
  expect(memberEmpty.querySelector('svg.lucide-calendar-days')).toBeTruthy()
  expect(within(memberEmpty).getByText('회장단과 부서장이 만들어요')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '새 행사' })).toBeNull()
})

test('만들기: 행사명이 계약 상한을 넘으면 보내지 않고 칸 아래에 알린다', async () => {
  const { api } = setup()
  const form = await openCreate()
  const name = await within(form).findByLabelText('행사명')
  fireEvent.change(name, { target: { value: '가'.repeat(EVENT_NAME_MAX + 1) } })
  fireEvent.click(within(form).getByRole('button', { name: '만들기' }))
  expect(within(form).getByText('더 짧게 입력해 주세요')).toBeTruthy()
  expect(name.getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})
