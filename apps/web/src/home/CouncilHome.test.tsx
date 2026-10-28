// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { CouncilView, HomeResponse } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import {
  boardEvent,
  councilHome,
  followUpRow,
  homeTask,
  noRooms,
  roomsOf,
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

test('인사 카드 → 전체 행사 진행 현황 → 확인이 필요한 운영 상황 · 후속 정리 중인 행사 · 가까운 주요 일정 차례이고 지금 홈의 부분이 없다', async () => {
  const { api } = open(councilHome())
  await card('가까운 주요 일정')
  expect(headings()).toEqual([
    '김회장님, 안녕하세요',
    '전체 행사 진행 현황',
    '확인이 필요한 운영 상황',
    '후속 정리 중인 행사',
    '가까운 주요 일정',
  ])
  expect(screen.queryByText('학생회 행사와 확인할 일을 봐요')).toBeNull()
  for (const name of ['지금 볼 것', '부서별 막힌 곳', '지난 업무', '내 업무', '행사'])
    expect(screen.queryByRole('region', { name })).toBeNull()
  // 회장단 인사 카드에는 주요 행사 타일이 없고, 별도 읽기(내 요청, 행사 목록)도 없다.
  expect(screen.queryByText('학생회 주요 행사')).toBeNull()
  await settle()
  expect(api.calls.map(call => call.path)).toEqual(['/api/organizations/c1/home'])
})

test('기준 시각 안내 없이 인사 카드 아래 내 업무 바로가기가 내 업무로 간다', async () => {
  open(councilHome({}, { myTasks: { open: 4, overdue: 1, nearest: null } }))
  const shortcut = await screen.findByRole('button', { name: '내 업무 4 · 지남 1' })
  expect(screen.queryByText(/끼룩이가/)).toBeNull()
  fireEvent.click(shortcut)
  expect(pathNow()).toBe('/tasks/c1?tab=mine')
})

test('메시지함은 인사 카드 안에 있다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/home', () => json(councilHome()))
  render(
    <HomePage
      view={councilView('c1')}
      rooms={roomsOf([
        {
          id: 'r1',
          type: 'direct',
          name: '김민준',
          departmentId: null,
          readOnly: false,
          unread: 1,
          mentions: 0,
          lastMessageAt: '2026-10-23T00:00:00.000Z',
          lastMessage: null,
          memberCount: 2,
        },
      ])}
      onForbidden={vi.fn()}
      onOpenEvent={vi.fn()}
      onOpenPage={vi.fn()}
    />,
  )
  const greeting = await card('김회장님, 안녕하세요')
  expect(within(greeting).getByRole('region', { name: '메시지함' })).toBeTruthy()
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
  expect(pathNow()).toBe('/events/c1/e1?tab=tasks&view=unassigned')
  fireEvent.click(one.getByRole('button', { name: '지남 2' }))
  expect(pathNow()).toBe('/events/c1/e1?tab=tasks')
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

test('확인이 필요한 운영 상황: 지남 다음 담당자 없음, 줄에 부서 또는 학생회 업무 · 행사 · 마감, 미배정 조건부 줄', async () => {
  const late = homeTask('late', 'overdue', {
    department: { id: 'd1', name: '기획부' },
    event: { id: 'e1', name: '가을 축제' },
    dueDate: '2026-10-21',
  })
  const free = homeTask('free', 'soon', { assignee: null, dueDate: '2026-10-28' })
  open(
    councilHome({
      attention: {
        items: [
          { task: late, reason: 'overdue' },
          { task: free, reason: 'unassigned' },
        ],
        total: 5,
      },
      unassignedMembers: 2,
    }),
  )
  const attention = await card('확인이 필요한 운영 상황')
  const [first, second] = within(attention).getAllByRole('listitem')
  expect(first!.textContent).toContain('기획부 · 가을 축제 · 10월 21일 (수) 마감')
  expect(within(first!).getByText('지남')).toBeTruthy()
  expect(second!.textContent).toContain('학생회 업무 · 10월 28일 (수) 마감')
  expect(within(second!).getByText('담당자 없음')).toBeTruthy()
  fireEvent.click(within(first!).getByRole('button', { name: '업무 late' }))
  expect(pathNow()).toBe('/tasks/c1/late')
  fireEvent.click(within(attention).getByRole('button', { name: '전체 5건 보기' }))
  expect(pathNow()).toBe('/tasks/c1?view=all')
  fireEvent.click(within(attention).getByRole('button', { name: /미배정 구성원/ }))
  expect(pathNow()).toBe('/people/c1')
  expect(within(attention).getByText('2명')).toBeTruthy()
})

test('미배정이 0이면 조건부 줄이 없고, 확인할 것이 없으면 확인할 일 없음이다', async () => {
  open(councilHome())
  const attention = await card('확인이 필요한 운영 상황')
  expect(within(attention).getByText('확인할 일 없음')).toBeTruthy()
  expect(within(attention).queryByText(/미배정 구성원/)).toBeNull()
})

test.each(['president', 'vice_president'] as const)(
  '재정 담당이 없으면 %s 홈에 한 줄과 조직의 재정 부서로 가는 길이 있다',
  async councilRank => {
    open(councilHome({ financeStaffed: false }), councilView('c1', { councilRank }))
    const attention = await card('확인이 필요한 운영 상황')
    expect(within(attention).getByText('재정 담당 · 없음')).toBeTruthy()
    fireEvent.click(within(attention).getByRole('button', { name: '조직에서 정하기' }))
    expect(pathNow()).toBe('/people/c1')
    expect(pageState()).toBe('finance')
  },
)

test('재정 담당이 있으면 안내 줄과 조직에서 정하기가 없다', async () => {
  open(councilHome({ financeStaffed: true }))
  await card('확인이 필요한 운영 상황')
  expect(screen.queryByText('재정 담당 · 없음')).toBeNull()
  expect(screen.queryByRole('button', { name: '조직에서 정하기' })).toBeNull()
})

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
  // 일정은 도착할 원래 화면 하나가 없어 전체 보기 없이 수만 있다(DEC-95).
  expect(within(upcoming).getByText('4건')).toBeTruthy()
  expect(within(upcoming).queryByRole('button', { name: /전체/ })).toBeNull()
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
