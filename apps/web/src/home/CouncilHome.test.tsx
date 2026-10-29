// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CouncilView, HomeResponse } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { chatRoomUrl, menuPath } from '@vada/contracts'
import { councilHome, emptyOps, eventLane, noRooms, opsRow } from '@/test-support/home-fixtures'
import { mockApi, json } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { pageState } from '@/lib/app-location'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const pathNow = () => window.location.pathname + window.location.search

function open(home: HomeResponse, view: CouncilView = councilView('c1')) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/home', () => json(home))
  const fns = { onOpenEvent: vi.fn(), onOpenPage: vi.fn() }
  render(<HomePage view={view} rooms={noRooms} onForbidden={vi.fn()} {...fns} />)
  return { ...fns, api }
}

const card = async (name: string) => screen.findByRole('region', { name })
const headings = () =>
  screen.getAllByRole('heading', { level: 2 }).map(item => item.textContent?.trim())

test('①이 0건이면 머리 한 문장으로 합치고 ② → ③ → ⑤ 차례이며 지금 홈의 부분이 없다', async () => {
  const { api } = open(councilHome())
  await screen.findByRole('heading', { name: '이번 주 일정 없음' })
  expect(headings()).toEqual([
    '김회장님, 확인이 필요한 운영 상황 없어요',
    '진행 중인 행사 없음',
    '내가 할 일 없음',
    '이번 주 일정 없음',
  ])
  expect(screen.queryByRole('region', { name: '확인이 필요한 운영 상황' })).toBeNull()
  for (const name of ['지금 볼 것', '부서별 막힌 곳', '지난 업무', '내 업무', '행사', '메시지함'])
    expect(screen.queryByRole('region', { name })).toBeNull()
  expect(screen.getByText('10월 23일 (금)')).toBeTruthy()
  await settle()
  expect(api.calls.map(call => call.path)).toEqual(['/api/organizations/c1/home'])
})

test('①이 있으면 머리는 인사이고 ①이 행사 위에 온다', async () => {
  open(
    councilHome({
      ops: emptyOps({
        rows: [opsRow('t1', 'late', { days: 2 })],
        counts: { ...emptyOps().counts, late: 1 },
        total: 1,
      }),
    }),
  )
  await card('확인이 필요한 운영 상황')
  expect(headings()).toEqual([
    '김회장님, 안녕하세요',
    '확인이 필요한 운영 상황',
    '진행 중인 행사 없음',
    '내가 할 일 없음',
    '이번 주 일정 없음',
  ])
})

test('② 행사 줄: 이름 · 신호 알약 · 다음 일정이 있고, 신호는 신청 → 인원 관리, 미정 → 개요, 지남 → 업무 탭 거르기, 예산 → 재정 탭이다', async () => {
  const planning = { id: '01900000-0000-7000-8000-0000000000d1', name: '기획부' }
  const { onOpenEvent } = open(
    councilHome({
      lanes: {
        events: [
          eventLane('e1', {
            event: { ...eventLane('e1').event, name: '가을 축제', status: 'ongoing' },
            milestone: { kind: 'event_end', date: '2026-10-24', days: 1 },
            late: [
              { department: planning, overdue: 1 },
              { department: null, overdue: 2 },
            ],
            budget: { kind: 'over', amount: 30000 },
          }),
          eventLane('e2', {
            milestone: { kind: 'registration_close', date: '2026-10-25', days: 2 },
            registration: { formId: 'f1', count: 18, capacity: 40, full: false },
            undecided: ['place'],
          }),
          eventLane('e3', {
            milestone: null,
            registration: { formId: 'f2', count: 120, capacity: 120, full: true },
            budget: { kind: 'undecided' },
          }),
        ],
        total: 5,
      },
    }),
  )
  const lanes = await card('행사')
  expect(within(lanes).getByText('5')).toBeTruthy()
  const [first, second, third] = within(lanes).getAllByRole('listitem')
  expect(within(first!).getByRole('button', { name: '기획부 지남 1' }).textContent).toContain(
    '기획부 지남 1',
  )
  expect(within(first!).getByText('예산 30,000원 초과').className).toContain('text-danger')
  expect(within(second!).getByText('장소 미정').className).not.toContain('text-danger')
  expect(within(third!).getByText('120/120 마감').className).toContain('font-semibold')
  expect(within(third!).getByText('예산 미정')).toBeTruthy()
  fireEvent.click(within(first!).getByRole('button', { name: '가을 축제' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e1')
  fireEvent.click(within(first!).getByRole('button', { name: '학생회 업무 지남 2' }))
  expect(pathNow()).toBe('/events/c1/e1?tab=tasks&dept=none&due=overdue')
  fireEvent.click(within(first!).getByRole('button', { name: '기획부 지남 1' }))
  expect(pathNow()).toBe(`/events/c1/e1?tab=tasks&dept=${planning.id}&due=overdue`)
  fireEvent.click(within(first!).getByRole('button', { name: '예산 30,000원 초과' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e1', 'money')
  fireEvent.click(within(second!).getByRole('button', { name: /18\/40/ }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e2', 'registrations')
  fireEvent.click(within(second!).getByRole('button', { name: '장소 미정' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e2')
})

test('행사가 셋보다 많으면 끝나지 않은 행사 수로 전체 n개 보기가 있고 행사 목록에 간다', async () => {
  const events = ['e1', 'e2', 'e3'].map(id => eventLane(id))
  const { onOpenPage } = open(councilHome({ lanes: { events, total: 4 } }))
  const lanes = await card('행사')
  fireEvent.click(within(lanes).getByRole('button', { name: '전체 4개 보기' }))
  expect(onOpenPage).toHaveBeenCalledWith('events')
})

test('행사가 없으면 진행 중인 행사 없음 띠와 [새 행사]가 있고 누르면 새 행사 창이 열린다', async () => {
  open(councilHome())
  const lanes = await card('진행 중인 행사 없음')
  fireEvent.click(within(lanes).getByRole('button', { name: '새 행사' }))
  expect(await screen.findByRole('dialog', { name: '새 행사' })).toBeTruthy()
})

test('event.create가 없는 회장단에게는 [새 행사]가 없다', async () => {
  open(councilHome(), councilView('c1', { councilRank: 'vice_president', permissions: [] }))
  const lanes = await card('진행 중인 행사 없음')
  expect(within(lanes).queryByRole('button', { name: '새 행사' })).toBeNull()
})

const head = (name: string, department = '기획부') => ({
  memberId: `m-${name}`,
  name,
  role: { kind: 'head' as const, department, title: '부장' },
  tint: 1,
})

test('① 줄: 아이콘 원 · 제목 · 사실(지남·오늘만 위험 색) · 행사, 제목은 업무·요청을 열고 묻기는 그 사람과의 1:1을 연다', async () => {
  const rows = [
    opsRow('t1', 'late', {
      title: '체험 부스 구성안 확정',
      days: 3,
      event: { id: 'e1', name: '가을 축제' },
      contact: head('김민준'),
    }),
    opsRow('t2', 'tomorrow', {
      title: '순서표',
      days: 1,
      contact: { memberId: 'm2', name: '이서연', role: { kind: 'assignee' }, tint: 2 },
    }),
    opsRow('r1', 'approval', { title: '다과 구매', days: 3, contact: head('정하늘', '재정부') }),
  ]
  const { api } = open(
    councilHome({
      ops: emptyOps({ rows, counts: { late: 1, today: 0, tomorrow: 1, approval: 1 }, total: 3 }),
    }),
  )
  const ops = await card('확인이 필요한 운영 상황')
  expect(within(ops).getByText('3', { selector: 'span' })).toBeTruthy()
  const [late, tomorrow, approval] = within(ops).getAllByRole('listitem')
  expect(late!.textContent).toContain('3일 지남')
  expect(late!.textContent).toContain('가을 축제')
  expect(within(late!).getByText('3일 지남').className).toContain('text-danger')
  expect(within(late!).getByText('김민준 기획부장에게 묻기')).toBeTruthy()
  expect(within(tomorrow!).getByText('내일 마감').className).not.toContain('text-danger')
  expect(within(tomorrow!).getByText('이서연 담당자에게 묻기')).toBeTruthy()
  expect(within(approval!).getByText('결재 대기 D-3')).toBeTruthy()
  expect(within(approval!).getByText('정하늘 재정부장에게 묻기')).toBeTruthy()
  fireEvent.click(within(late!).getByRole('button', { name: '체험 부스 구성안 확정' }))
  expect(pathNow()).toBe('/tasks/c1/t1')
  fireEvent.click(within(approval!).getByRole('button', { name: '다과 구매' }))
  expect(pathNow()).toBe('/purchases/c1/r1')
  expect(screen.queryByRole('button', { name: /전체 \d+건 보기/ })).toBeNull()
  // 묻기는 업무가 아니라 그 사람과의 1:1을 연다(메시지 화면 오른쪽 1:1 칸).
  api.on('POST', '/api/organizations/c1/direct', () => json({ roomId: 'd1' }))
  fireEvent.click(within(late!).getByRole('button', { name: /김민준 기획부장에게 묻기/ }))
  await waitFor(() => expect(pathNow()).toBe(chatRoomUrl('c1', 'd1')))
  expect(api.calls.filter(call => call.path.endsWith('/direct')).map(call => call.body)).toEqual([
    { memberId: 'm-김민준' },
  ])
})

test('1:1 권한이 없거나 나에게 묻는 줄이면 묻기는 글로만 보인다', async () => {
  const me = { memberId: 'm1', name: '김회장', role: { kind: 'assignee' as const }, tint: 0 }
  const rows = [
    opsRow('t1', 'late', { days: 2, contact: head('김민준') }),
    opsRow('t2', 'late', { days: 2, contact: me }),
  ]
  const home = councilHome({
    ops: emptyOps({ rows, counts: { ...emptyOps().counts, late: 2 }, total: 2 }),
  })
  open(home, councilView('c1', { permissions: [] }))
  const ops = await card('확인이 필요한 운영 상황')
  expect(within(ops).getByText('김민준 기획부장에게 묻기')).toBeTruthy()
  expect(within(ops).queryByRole('button', { name: /묻기/ })).toBeNull()
  cleanup()
  open(home)
  const again = await card('확인이 필요한 운영 상황')
  expect(within(again).getAllByRole('button', { name: /묻기/ })).toHaveLength(1)
})

test('배정할 일이 있으면 일 줄은 4줄이고 배정 줄이 맨 아래, 전체 보기는 숨은 갈래를 세고 누르면 홈 안에서 펼친다', async () => {
  const rows = [
    opsRow('a', 'late', { days: 2 }),
    opsRow('b', 'late', { days: 1 }),
    opsRow('c', 'today'),
    opsRow('d', 'tomorrow', { days: 1 }),
    opsRow('e', 'tomorrow', { days: 1 }),
    opsRow('f', 'approval', { days: 2 }),
  ]
  open(
    councilHome({
      ops: emptyOps({
        rows,
        counts: { late: 2, today: 1, tomorrow: 2, approval: 3 },
        assign: { by: 'council', noDepartment: 2, unassignedMembers: 1, financeStaffed: false },
        total: 12,
      }),
    }),
  )
  const ops = await card('확인이 필요한 운영 상황')
  const items = within(ops).getAllByRole('listitem')
  expect(items).toHaveLength(5)
  expect(items[4]!.textContent).toContain('회장단이 배정할 일')
  const seeAll = within(ops).getByRole('button', { name: /전체 12건 보기/ })
  expect(within(seeAll).getByText('외 4건 · 내일 마감 1, 결재 대기 3')).toBeTruthy()
  fireEvent.click(seeAll)
  expect(within(ops).getAllByRole('listitem')).toHaveLength(7)
  // 서버 상한(50줄) 밖에 남은 줄은 펼친 뒤에도 수로 남는다(누를 곳은 없다).
  expect(within(ops).queryByRole('button', { name: /전체 12건 보기/ })).toBeNull()
  expect(within(ops).getByText('외 2건 · 결재 대기 2')).toBeTruthy()
})

test('부장 없는 부서의 줄은 누구 칸에 부서 · 부장 없음과 부장 정하기를 두고 조직의 그 부서로 간다', async () => {
  const rows = [opsRow('t1', 'late', { days: 2, noHead: { id: 'd2', name: '기획부' } })]
  open(
    councilHome({ ops: emptyOps({ rows, counts: { ...emptyOps().counts, late: 1 }, total: 1 }) }),
  )
  const ops = await card('확인이 필요한 운영 상황')
  const [row] = within(ops).getAllByRole('listitem')
  expect(within(row!).getByText('기획부 · 부장 없음')).toBeTruthy()
  expect(within(row!).queryByText(/묻기/)).toBeNull()
  fireEvent.click(within(row!).getByRole('button', { name: '부장 정하기' }))
  expect(pathNow()).toBe('/people/c1')
  expect(pageState()).toEqual({ department: 'd2' })
})

test.each(['president', 'vice_president'] as const)(
  '%s 홈의 배정 줄: 부서 미정 업무는 업무 목록의 부서 없음 + 담당자 없음, 미배정은 사람, 재정 담당 없음은 조직의 재정 부서로 간다',
  async councilRank => {
    open(
      councilHome({
        ops: emptyOps({
          assign: { by: 'council', noDepartment: 3, unassignedMembers: 2, financeStaffed: false },
          total: 5,
        }),
      }),
      councilView('c1', { councilRank }),
    )
    const ops = await card('확인이 필요한 운영 상황')
    fireEvent.click(within(ops).getByRole('button', { name: '부서 미정 업무 3건' }))
    expect(pathNow()).toBe(
      menuPath('tasks', 'c1', {
        tab: 'council',
        events: 'include',
        dept: 'none',
        assignee: 'none',
      }),
    )
    expect(pathNow()).toContain('dept=none')
    fireEvent.click(within(ops).getByRole('button', { name: '미배정 구성원 2명' }))
    expect(pathNow()).toBe('/people/c1')
    fireEvent.click(within(ops).getByRole('button', { name: '재정 담당 없음' }))
    expect(pathNow()).toBe('/people/c1')
    expect(pageState()).toBe('finance')
  },
)
