// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { CouncilView, HomeResponse } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { menuPath } from '@vada/contracts'
import {
  boardEvent,
  councilHome,
  emptyOps,
  followUpRow,
  homeTask,
  noRooms,
  opsRow,
} from '@/test-support/home-fixtures'
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
  await card('가까운 주요 일정')
  expect(headings()).toEqual([
    '김회장님, 확인이 필요한 운영 상황 없어요',
    '전체 행사 진행 현황',
    '후속 정리 중인 행사',
    '가까운 주요 일정',
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
    '전체 행사 진행 현황',
    '후속 정리 중인 행사',
    '가까운 주요 일정',
  ])
})

test('행사 카드: 상태 칩, 이름, 날짜 · D-N, 업무 막대, 이유 칩, 다음 마감이 있고 책임자가 없다', async () => {
  const { onOpenEvent } = open(
    councilHome({
      events: {
        cards: [
          boardEvent('e1', {
            tasks: { done: 1, total: 4, overdue: 2, unassigned: 1 },
            next: { kind: 'task', dueDate: '2026-10-28', title: '부스 배치안 확정' },
          }),
          boardEvent('e2', {
            next: { kind: 'start', startsAt: '2026-10-27T10:00' },
          }),
        ],
        counts: { planning: 3, ongoing: 1, followUp: 2 },
      },
    }),
  )
  const events = await card('전체 행사 진행 현황')
  expect(within(events).getByText('기획 중 3 · 진행 중 1 · 후속 정리 중 2')).toBeTruthy()
  const [first, second] = within(events).getAllByRole('listitem')
  const one = within(first!)
  expect(one.getByText('기획 중')).toBeTruthy()
  expect(one.getByText('10월 27일 (화) · D-4')).toBeTruthy()
  expect(one.getByText('1/4')).toBeTruthy()
  expect(one.getByText('다음 마감 · 10월 28일 (수) 부스 배치안 확정')).toBeTruthy()
  expect(within(second!).getByText('다음 일정 · 10월 27일 (화) 10:00 행사 시작')).toBeTruthy()
  expect(within(second!).getByText('확인 필요 없음')).toBeTruthy()
  expect(within(events).queryByText(/김회장/)).toBeNull()
  fireEvent.click(one.getByRole('button', { name: '행사 e1' }))
  expect(onOpenEvent).toHaveBeenCalledWith('e1')
  // 이유 칩은 그 행사 업무 탭이다. 담당자 없음은 그 보기로 거른다.
  fireEvent.click(one.getByRole('button', { name: '담당자 없음 1' }))
  expect(pathNow()).toBe('/events/c1/e1?tab=tasks&assignee=none')
  fireEvent.click(one.getByRole('button', { name: '지남 2' }))
  expect(pathNow()).toBe('/events/c1/e1?tab=tasks&due=overdue')
})

test('행사가 셋보다 많으면 머리 상태별 수의 합으로 전체 n개 보기가 있고 행사 목록에 간다', async () => {
  const cards = ['e1', 'e2', 'e3'].map(id => boardEvent(id))
  const { onOpenPage } = open(
    councilHome({ events: { cards, counts: { planning: 3, ongoing: 1, followUp: 2 } } }),
  )
  const events = await card('전체 행사 진행 현황')
  fireEvent.click(within(events).getByRole('button', { name: '전체 6개 보기' }))
  expect(onOpenPage).toHaveBeenCalledWith('events')
})

test('행사가 없으면 진행할 행사 없음과 [새 행사]가 있고 누르면 새 행사 창이 열린다', async () => {
  open(councilHome())
  const events = await card('전체 행사 진행 현황')
  expect(within(events).getByText('진행할 행사 없음')).toBeTruthy()
  // 행사가 하나도 없으면 머리는 상태별 수 대신 회색 '0개'다.
  expect(within(events).getByText('0개')).toBeTruthy()
  expect(within(events).queryByText(/기획 중 0/)).toBeNull()
  fireEvent.click(within(events).getByRole('button', { name: '새 행사' }))
  expect(await screen.findByRole('dialog', { name: '새 행사' })).toBeTruthy()
})

test('event.create가 없는 회장단에게는 [새 행사]가 없다', async () => {
  open(councilHome(), councilView('c1', { councilRank: 'vice_president', permissions: [] }))
  const events = await card('전체 행사 진행 현황')
  expect(within(events).getByText('진행할 행사 없음')).toBeTruthy()
  expect(within(events).queryByRole('button', { name: '새 행사' })).toBeNull()
})

const head = (name: string, department = '기획부') => ({
  memberId: `m-${name}`,
  name,
  role: { kind: 'head' as const, department, title: '부장' },
  tint: 1,
})

test('① 줄: 아이콘 원 · 제목 · 사실(지남·오늘만 위험 색) · 행사, 연락할 사람에게 묻기는 누르는 곳이 아니고 제목은 업무·요청을 연다', async () => {
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
  open(
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
  // 묻기는 시연 뒤라 단추가 아니다.
  expect(within(ops).queryByRole('button', { name: /묻기/ })).toBeNull()
  fireEvent.click(within(late!).getByRole('button', { name: '체험 부스 구성안 확정' }))
  expect(pathNow()).toBe('/tasks/c1/t1')
  fireEvent.click(within(approval!).getByRole('button', { name: '다과 구매' }))
  expect(pathNow()).toBe('/purchases/c1/r1')
  expect(screen.queryByRole('button', { name: /전체 \d+건 보기/ })).toBeNull()
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
        assign: { noDepartment: 2, unassignedMembers: 1, financeStaffed: false },
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
          assign: { noDepartment: 3, unassignedMembers: 2, financeStaffed: false },
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

test('후속 정리 중인 행사: 종료 날짜, 7일째부터 끝난 지 N일, 남은 정리, 다 0이면 완료 가능. 정산이 남으면 구매 탭으로 연다', async () => {
  const { onOpenEvent } = open(
    councilHome({
      followUp: {
        events: [
          followUpRow('e1', { remaining: { tasks: 2, settlement: 1 } }),
          followUpRow('e2', {
            event: { ...followUpRow('e2').event, endsAt: '2026-10-20T12:00' },
            endedDays: 3,
          }),
        ],
        total: 2,
      },
    }),
  )
  const followUp = await card('후속 정리 중인 행사')
  const [first, second] = within(followUp).getAllByRole('listitem')
  expect(within(first!).getByText('후속 정리 중')).toBeTruthy()
  expect(first!.textContent).toContain('10월 8일 (목) 종료 · 끝난 지 15일')
  expect(first!.textContent).toContain('남은 정리: 업무 2 · 정산 1')
  expect(second!.textContent).toContain('10월 20일 (화) 종료')
  expect(second!.textContent).not.toContain('끝난 지')
  expect(second!.textContent).toContain('완료 가능')
  fireEvent.click(within(first!).getByRole('button', { name: '행사 e1' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e1', 'money')
  fireEvent.click(within(second!).getByRole('button', { name: '행사 e2' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e2')
  expect(within(followUp).getByText('2개')).toBeTruthy()
})

test('가까운 주요 일정: 날짜와 종류 칩이 있고 줄을 누르면 그 업무, 행사, 행사 인원 관리 탭으로 간다', async () => {
  const task = homeTask('t1', 'soon', {
    title: '부스 배치안 확정',
    event: { id: 'e1', name: '가을 축제' },
  })
  const event = { id: 'e2', name: '진로 특강' }
  const { onOpenEvent } = open(
    councilHome(
      {},
      {
        upcoming: {
          items: [
            { kind: 'task_due', date: '2026-10-24', time: null, task },
            {
              kind: 'registration_close',
              date: '2026-10-26',
              time: '18:00',
              event,
              form: { id: 'f1', name: '신청' },
            },
            { kind: 'event_start', date: '2026-10-27', time: '10:00', event },
          ],
          total: 4,
        },
      },
    ),
  )
  const upcoming = await card('가까운 주요 일정')
  const [due, close, start] = within(upcoming).getAllByRole('listitem')
  expect(due!.textContent).toContain('10월 24일 (토)')
  expect(due!.textContent).toContain('가을 축제 · 업무 마감')
  // 일정 종류는 상태 칩('지남')과 갈라 테두리 없는 태그다(와이어프레임 HomePrototypeScheduleTag).
  expect(within(due!).getByText('마감').className).toContain('border-transparent')
  expect(within(close!).getByRole('button', { name: '진로 특강 신청 마감' })).toBeTruthy()
  expect(close!.textContent).toContain('18:00 · 참가 신청')
  expect(within(start!).getByText('행사')).toBeTruthy()
  expect(start!.textContent).toContain('10:00 · 행사 시작')
  fireEvent.click(within(upcoming).getByRole('button', { name: '전체 4건 보기' }))
  expect(pathNow()).toBe('/calendar/c1')
  fireEvent.click(within(close!).getByRole('button', { name: '진로 특강 신청 마감' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e2', 'registrations')
  fireEvent.click(within(start!).getByRole('button', { name: '진로 특강' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e2')
  fireEvent.click(within(due!).getByRole('button', { name: '부스 배치안 확정' }))
  expect(pathNow()).toBe('/tasks/c1/t1')
})

test('후속 정리 중인 행사가 셋보다 많으면 전체 n개 보기로 결산 탭에 간다', async () => {
  const events = ['e1', 'e2', 'e3', 'e4'].map(id => followUpRow(id))
  open(councilHome({ followUp: { events, total: 5 } }))
  const followUp = await card('후속 정리 중인 행사')
  expect(within(followUp).getAllByRole('listitem')).toHaveLength(3)
  fireEvent.click(within(followUp).getByRole('button', { name: '전체 5개 보기' }))
  expect(pathNow()).toBe('/finance/c1?tab=closing')
})
