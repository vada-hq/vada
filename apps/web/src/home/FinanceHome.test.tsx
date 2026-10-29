// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { HomeFinanceBoard, HomeResponse } from '@vada/contracts'
import type { RoomListState } from '@/chat/useRoomList'
import { room } from '@/test-support/chat-fixtures'
import { councilView } from '@/test-support/council-fixtures'
import {
  councilHome,
  homeRequest,
  homeResponse,
  noRooms,
  roomsOf,
} from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})
const board = (extra: Partial<HomeFinanceBoard> = {}): HomeFinanceBoard => ({
  pending: { requests: [], total: 0, truncated: false },
  nearby: { items: [], total: 0 },
  settling: { events: [], total: 0 },
  budgets: { events: [], total: 0 },
  departments: [],
  ownedEnded: [],
  ...extra,
})
const finance = (extra: Partial<HomeFinanceBoard> = {}) =>
  homeResponse({ kind: 'finance', financeBoard: board(extra) })
function open(home: HomeResponse, rooms: RoomListState = noRooms) {
  const api = mockApi()
  api.on('GET', '/api/organizations/01900000-0000-7000-8000-000000000001/home', () => json(home))
  render(
    <HomePage
      view={councilView('01900000-0000-7000-8000-000000000001')}
      rooms={rooms}
      onForbidden={vi.fn()}
      onOpenEvent={vi.fn()}
      onOpenPage={vi.fn()}
    />,
  )
  return api
}
const card = (name: string) => screen.findByRole('region', { name })
const path = () => window.location.pathname + window.location.search

test('재정부 홈의 내 업무 바로가기는 내 업무 탭을 명시한다', async () => {
  open(finance())
  fireEvent.click(await screen.findByRole('button', { name: '내 업무 0' }))
  expect(path()).toBe('/tasks/01900000-0000-7000-8000-000000000001?tab=mine')
})

test('재정부 홈은 인사와 바로가기 → 2×2 카드, 빈 카드와 0건을 두고 별도 읽기·주기 읽기가 없다', async () => {
  const api = open(finance())
  await card('행사별 예산')
  expect(screen.getAllByRole('heading', { level: 2 }).map(row => row.textContent)).toEqual([
    '김회장님, 안녕하세요',
    '결재 대기',
    '필요한 때 가까운 품목',
    '예외·대기',
    '행사별 예산',
  ])
  expect(screen.getAllByText('0건')).toHaveLength(3)
  expect(within(await card('행사별 예산')).getByText('0개')).toBeTruthy()
  expect(screen.queryByText(/통장 잔액과 다름/)).toBeNull()
  expect(screen.queryByText('결재할 요청과 필요한 때가 가까운 준비를 봐요')).toBeNull()
  expect(screen.queryByText(/끼룩이가/)).toBeNull()
  expect(screen.getByRole('button', { name: '내 업무 0' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /안 읽은 방/ })).toBeNull()
  await settle()
  expect(api.calls.map(row => row.path)).toEqual([
    '/api/organizations/01900000-0000-7000-8000-000000000001/home',
  ])
})

test('안 읽은 방은 메시지함에만 보이고 내 업무 바로가기는 유지한다', async () => {
  open(finance(), roomsOf([room('notice', { type: 'all_members', unread: 2 })]))
  const greeting = await card('김회장님, 안녕하세요')
  expect(within(greeting).queryByRole('button', { name: /^안 읽은 방/ })).toBeNull()
  const inbox = within(greeting).getByRole('region', { name: '메시지함' })
  expect(within(inbox).getByRole('button', { name: '공지방, 안 읽은 메시지 2개' })).toBeTruthy()
  fireEvent.click(within(inbox).getByRole('button', { name: '전체 보기' }))
  expect(path()).toBe('/chat/01900000-0000-7000-8000-000000000001')
  fireEvent.click(within(greeting).getByRole('button', { name: '내 업무 0' }))
  expect(path()).toBe('/tasks/01900000-0000-7000-8000-000000000001?tab=mine')
})

test('결재 대기는 서버 차례의 앞 셋, 필요한 때 3일 임박은 노랑이고 전체 보기는 결재 대기다', async () => {
  open(
    finance({
      pending: {
        requests: ['r1', 'r2', 'r3', 'r4'].map(id => ({
          ...homeRequest(id),
          neededBy: '2026-10-26',
        })),
        total: 4,
        truncated: false,
      },
    }),
  )
  const pending = await card('결재 대기')
  const rows = within(pending).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(rows.map(row => row.textContent)).toEqual(
    expect.arrayContaining([expect.stringContaining('요청 r1')]),
  )
  expect(within(rows[0]!).getByText('임박').className).toContain('warning')
  fireEvent.click(within(rows[0]!).getByRole('button', { name: '요청 r1' }))
  expect(path()).toBe('/purchases/01900000-0000-7000-8000-000000000001/r1')
  fireEvent.click(within(pending).getByRole('button', { name: '전체 4건 보기' }))
  expect(path()).toBe('/purchases/01900000-0000-7000-8000-000000000001?view=pending')
})

test('품목은 요청으로, 예산 미입력·음수 사용 가능은 받은 값 그대로 행사 재정으로 간다', async () => {
  open(
    finance({
      nearby: {
        items: [
          { id: 'l1', name: '부스 테이블', requestId: 'r1', event: null, neededBy: '2026-10-26' },
        ],
        total: 1,
      },
      budgets: {
        events: [
          {
            event: { id: 'e1', name: '가을 축제' },
            budget: {
              event: { id: 'e1', name: '가을 축제' },
              amount: 100,
              actual: 80,
              committed: 40,
              available: -20,
            },
          },
          { event: { id: 'e2', name: '체육대회' }, budget: null },
        ],
        total: 2,
      },
    }),
  )
  const nearby = await card('필요한 때 가까운 품목')
  fireEvent.click(within(nearby).getByRole('button', { name: '부스 테이블' }))
  expect(path()).toBe('/purchases/01900000-0000-7000-8000-000000000001/r1')
  const budgets = await card('행사별 예산')
  expect(within(budgets).getByText('2개')).toBeTruthy()
  expect(within(budgets).getByText('사용 가능')).toBeTruthy()
  expect(within(budgets).getByText('예산 미입력')).toBeTruthy()
  expect(within(budgets).getByText('-20원').className).toContain('danger')
  fireEvent.click(within(budgets).getByRole('button', { name: '가을 축제' }))
  expect(path()).toBe('/events/01900000-0000-7000-8000-000000000001/e1?tab=money')
})

// 회장단 홈의 재정은 '사용 가능' 한 줄이다(c35 안 b). 예산 미입력 행사는 ② 행사 신호로 옮겨 간다(시연 조각 ㉰).
test('회장단 홈의 사용 가능 한 줄은 음수를 위험 색으로 보이고 재정 첫 화면을 연다', async () => {
  open(
    councilHome(
      {},
      {
        financeSummary: {
          overview: { total: 100, actual: 80, committed: 40, available: -20 },
          missing: [{ id: 'e2', name: '체육대회' }],
        },
      },
    ),
  )
  const line = await screen.findByRole('region', { name: '사용 가능' })
  expect(screen.queryByRole('region', { name: '전체 재정 요약' })).toBeNull()
  expect(within(line).getByText('-20원').className).toContain('danger')
  fireEvent.click(within(line).getByRole('button', { name: '재정 보기' }))
  expect(path()).toBe('/finance/01900000-0000-7000-8000-000000000001')
})

test('회장단+재정 전환은 replace 주소로 남고 새로 열어도 재정 보기이며 권한 없으면 지운다', async () => {
  window.history.replaceState(null, '', '/home/01900000-0000-7000-8000-000000000001?view=finance')
  const home = councilHome({}, { financeView: true, financeBoard: board() })
  open(home)
  await card('결재 대기')
  const length = window.history.length
  fireEvent.click(screen.getByRole('button', { name: '운영 보기' }))
  await card('진행 중인 행사 없음')
  expect(path()).toBe('/home/01900000-0000-7000-8000-000000000001')
  fireEvent.click(screen.getByRole('button', { name: '재정 보기' }))
  await card('결재 대기')
  expect(path()).toBe('/home/01900000-0000-7000-8000-000000000001?view=finance')
  expect(window.history.length).toBe(length)
  cleanup()
  open(finance())
  await card('결재 대기')
  await settle()
  expect(path()).toBe('/home/01900000-0000-7000-8000-000000000001')
  expect(screen.queryByRole('button', { name: '운영 보기' })).toBeNull()
})

test('재정부장 조건부 줄은 대상 있을 때만 보이며 부서와 책임 행사로 간다', async () => {
  open(
    finance({
      departments: [
        { id: '01900000-0000-7000-8000-000000000002', name: '재정부', overdue: 2, unassigned: 1 },
      ],
      ownedEnded: [
        {
          event: { id: 'e1', name: '내 끝난 행사', startsAt: null, endsAt: null, status: 'ended' },
          endedDays: 7,
          remaining: { tasks: 1, settlement: 2 },
        },
      ],
    }),
  )
  await card('예외·대기')
  const department = screen.getByRole('button', { name: /부서 업무 지남 2 · 담당자 없음 1/ })
  fireEvent.click(department)
  expect(path()).toBe(
    '/tasks/01900000-0000-7000-8000-000000000001?dept=01900000-0000-7000-8000-000000000002&events=include',
  )
  fireEvent.click(screen.getByRole('button', { name: /내 끝난 행사 · 후속 정리 중/ }))
  expect(path()).toBe('/events/01900000-0000-7000-8000-000000000001/e1?tab=money')
})

test('예외 카드에 보이는 책임 행사는 남은 업무·정산을 함께 보이고 조건부 줄에서 반복하지 않는다', async () => {
  const event = {
    id: 'e1',
    name: '내 끝난 행사',
    startsAt: '2026-10-16T10:00',
    endsAt: null,
    status: 'ended' as const,
  }
  open(
    finance({
      ownedEnded: [{ event, endedDays: 7, remaining: { tasks: 1, settlement: 2 } }],
      settling: {
        events: [
          {
            event: { ...event, owner: null, place: null },
            endedDays: 7,
            settlement: { remaining: 2, settled: false },
          },
        ],
        total: 1,
      },
    }),
  )
  const exceptions = await card('예외·대기')
  expect(within(exceptions).getByText('남은 정리: 업무 1 · 정산 2')).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /내 끝난 행사/ })).toHaveLength(1)
})
