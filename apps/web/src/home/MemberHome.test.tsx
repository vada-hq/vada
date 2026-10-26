// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { CouncilView, HomeResponse, RoomSummary } from '@vada/contracts'
import type { RoomListState } from '@/chat/useRoomList'
import { councilView } from '@/test-support/council-fixtures'
import {
  homeEvent,
  homeRequest,
  homeResponse,
  homeTask,
  memberHome,
  noRooms,
  participation,
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

const pathNow = () => window.location.pathname + window.location.search

// 부서가 있는 부원(기획부). 부서 배정 전 띠가 없다.
const memberView = (departments: CouncilView['me']['departments'] = [PLANNING]) =>
  councilView('c1', { councilRank: null, departments })
const PLANNING = { id: 'd1', name: '기획부', role: null, rank: null }

function open(
  home: HomeResponse,
  { view = memberView(), rooms = noRooms }: { view?: CouncilView; rooms?: RoomListState } = {},
) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/home', () => json(home))
  const fns = { onOpenEvent: vi.fn(), onOpenPage: vi.fn() }
  render(<HomePage view={view} rooms={rooms} onForbidden={vi.fn()} {...fns} />)
  return { ...fns, api }
}

const card = async (name: string) => screen.findByRole('region', { name })
const headings = () =>
  screen.getAllByRole('heading', { level: 2 }).map(item => item.textContent?.trim())

const room = (id: string, extra: Partial<RoomSummary> = {}): RoomSummary => ({
  id,
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 1,
  mentions: 0,
  lastMessageAt: '2026-10-23T00:00:00.000Z',
  lastMessage: null,
  memberCount: 3,
  ...extra,
})

test('인사 카드 → 참여 행사 진행 · 가까운 일정 / 내 요청 · 내 업무·메시지 차례이고 지금 홈의 부분과 따로 읽기가 없다', async () => {
  const { api } = open(memberHome())
  await card('내 업무·메시지')
  expect(headings()).toEqual([
    '김회장님, 안녕하세요',
    '참여 행사 진행',
    '가까운 일정',
    '내 요청',
    '내 업무·메시지',
  ])
  expect(screen.getByText('학생회 주요 행사와 참여 행사·일정을 봐요')).toBeTruthy()
  expect(screen.getByText('끼룩이가 09:00 기준으로 정리했어요')).toBeTruthy()
  for (const name of ['지금 볼 것', '내 업무', '이번 주 행사'])
    expect(screen.queryByRole('region', { name })).toBeNull()
  // 주기 읽기와 별도 읽기(내 요청, 행사 목록)가 없다(명세 027 정한 것 3).
  await settle()
  expect(api.calls.map(call => call.path)).toEqual(['/api/organizations/c1/home'])
})

test('아직 새 배치가 없는 종류(부서장)는 지금 홈 그대로다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/home', () => json(homeResponse()))
  api.on('GET', '/api/organizations/c1/purchase-requests?view=mine', () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', '/api/organizations/c1/events', () => json({ events: [], truncated: false }))
  render(
    <HomePage
      view={memberView()}
      rooms={noRooms}
      onForbidden={vi.fn()}
      onOpenEvent={vi.fn()}
      onOpenPage={vi.fn()}
    />,
  )
  expect(await screen.findByRole('region', { name: '지금 볼 것' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: '참여 행사 진행' })).toBeNull()
})

test('인사 카드: 메시지함(공지방 칩)과 학생회 주요 행사 타일 셋, 타일을 누르면 행사다', async () => {
  const { onOpenEvent } = open(
    memberHome({
      featuredEvents: [
        homeEvent('e1', { name: '가을 축제', status: 'ongoing', startsAt: '2026-10-23T10:00' }),
        homeEvent('e2', { name: '진로 특강', status: 'upcoming', startsAt: '2026-10-27T18:00' }),
        homeEvent('e3', { name: '체육대회', status: 'upcoming', startsAt: null }),
      ],
    }),
    { rooms: roomsOf([room('notice', { unread: 2 })]) },
  )
  const greeting = await card('김회장님, 안녕하세요')
  const inbox = within(greeting).getByRole('region', { name: '메시지함' })
  expect(within(inbox).getByRole('button', { name: '공지방, 안 읽은 메시지 2개' })).toBeTruthy()
  const featured = within(greeting).getByRole('region', { name: '학생회 주요 행사' })
  expect(within(featured).getByText('3개')).toBeTruthy()
  const [first, second, third] = within(featured).getAllByRole('listitem')
  expect(within(first!).getByText('진행 중')).toBeTruthy()
  expect(within(first!).getByText('10월 23일 (금)')).toBeTruthy()
  expect(within(second!).getByText('10월 27일 (화) · D-4')).toBeTruthy()
  expect(within(third!).getByText('미정')).toBeTruthy()
  fireEvent.click(within(second!).getByRole('button', { name: '진로 특강' }))
  expect(onOpenEvent).toHaveBeenCalledWith('e2')
})

test('참여 행사 진행: 상태 칩 · 행사명 · 날짜, 부서 업무 막대, 다음 마감. 누르면 행사이고 셋보다 많으면 전체 보기가 행사 목록이다', async () => {
  const { onOpenEvent, onOpenPage } = open(
    memberHome({
      participating: {
        events: [
          participation('e1', {
            event: homeEvent('e1', { name: '가을 축제', status: 'ongoing' }),
            tasks: { done: 8, total: 12 },
            next: { taskId: 't1', title: '부스 배치안 확정', dueDate: '2026-10-28' },
          }),
          participation('e2'),
          participation('e3'),
          participation('e4'),
        ],
        total: 5,
      },
    }),
  )
  const events = await card('참여 행사 진행')
  const rows = within(events).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  const first = within(rows[0]!)
  expect(first.getByText('진행 중')).toBeTruthy()
  expect(first.getByText('10월 20일 (화)')).toBeTruthy()
  expect(first.getByText('8/12')).toBeTruthy()
  expect(rows[0]!.textContent).toContain('부서 업무')
  expect(first.getByText('다음 마감 · 10월 28일 (수) 부스 배치안 확정')).toBeTruthy()
  expect(within(rows[1]!).getByText('다음 마감 없음')).toBeTruthy()
  fireEvent.click(first.getByRole('button', { name: '가을 축제' }))
  expect(onOpenEvent).toHaveBeenCalledWith('e1')
  fireEvent.click(within(events).getByRole('button', { name: '전체 5개 보기' }))
  expect(onOpenPage).toHaveBeenCalledWith('events')
})

test('참여 행사가 비면 참여 행사 없음과 누가 만드는지 한 줄이고 [새 행사]가 없다', async () => {
  open(memberHome())
  const events = await card('참여 행사 진행')
  expect(within(events).getByText('참여 행사 없음')).toBeTruthy()
  expect(within(events).getByText('회장단과 부서장이 만들어요')).toBeTruthy()
  expect(within(events).getByText('0개')).toBeTruthy()
  expect(within(events).queryByRole('button', { name: '새 행사' })).toBeNull()
})

test('가까운 일정은 그 카드 이름으로 받은 차례 그대로다', async () => {
  const event = { id: 'e2', name: '진로 특강' }
  open(
    memberHome({
      upcoming: {
        items: [
          {
            kind: 'task_due',
            date: '2026-10-24',
            time: null,
            task: homeTask('t1', 'soon', { title: '홍보 문안 전달' }),
          },
          { kind: 'event_start', date: '2026-10-27', time: '10:00', event },
        ],
        total: 2,
      },
    }),
  )
  const upcoming = await card('가까운 일정')
  const [due, start] = within(upcoming).getAllByRole('listitem')
  expect(due!.textContent).toContain('홍보 문안 전달')
  expect(start!.textContent).toContain('10:00 · 행사 시작')
  expect(within(upcoming).getByText('2건')).toBeTruthy()
})

test('내 요청: 받은 차례(반려 먼저) 그대로 상태 칩과 함께, 누르면 그 요청, 셋보다 많으면 재정 구매 요청 탭', async () => {
  const rejected = { ...homeRequest('no'), title: '현수막', status: 'rejected' as const }
  const pending = { ...homeRequest('wait'), title: '간식', event: { id: 'e1', name: '가을 축제' } }
  open(
    memberHome({
      myRequests: {
        requests: [rejected, pending, homeRequest('r3'), homeRequest('r4')],
        total: 4,
      },
    }),
  )
  const requests = await card('내 요청')
  const rows = within(requests).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(within(rows[0]!).getByText('반려')).toBeTruthy()
  expect(within(rows[1]!).getByText('결재 대기')).toBeTruthy()
  expect(rows[1]!.textContent).toContain('가을 축제 · 10월 20일 (화) 요청')
  fireEvent.click(within(rows[0]!).getByRole('button', { name: '현수막' }))
  expect(pathNow()).toBe('/purchases/c1/no')
  fireEvent.click(within(requests).getByRole('button', { name: '전체 4건 보기' }))
  expect(pathNow()).toBe('/finance/c1?tab=requests')
})

test('내 요청이 없으면 내 요청 없음이다', async () => {
  open(memberHome())
  const requests = await card('내 요청')
  expect(within(requests).getByText('내 요청 없음')).toBeTruthy()
})

test('내 업무·메시지: 내 업무 수와 가장 가까운 마감(지났으면 지남), 안 읽은 방 수. 누르면 업무 내 업무 탭과 대화다', async () => {
  const nearest = homeTask('t1', 'overdue', { title: '부스 배치안 확정', dueDate: '2026-10-21' })
  open(memberHome({ myTasks: { open: 3, overdue: 1, nearest } }), {
    rooms: roomsOf([
      room('a'),
      room('b', { type: 'direct', name: '김민준' }),
      room('c', { unread: 0 }),
    ]),
  })
  const work = await card('내 업무·메시지')
  expect(within(work).getByText('바로가기')).toBeTruthy()
  const [tasks, messages] = within(work).getAllByRole('listitem')
  expect(tasks!.textContent).toContain('가장 가까운 마감 10월 21일 (수) · 부스 배치안 확정')
  expect(within(tasks!).getByText('지남')).toBeTruthy()
  fireEvent.click(within(tasks!).getByRole('button', { name: '내 업무 3' }))
  expect(pathNow()).toBe('/tasks/c1')
  fireEvent.click(within(messages!).getByRole('button', { name: '안 읽은 방 2' }))
  expect(pathNow()).toBe('/chat/c1')
})

test('맡은 업무와 안 읽은 방이 없으면 그렇게 말하고, 대화 목록을 읽기 전이면 집계 전이다', async () => {
  open(memberHome(), { rooms: roomsOf([room('a', { unread: 0 })]) })
  const work = await card('내 업무·메시지')
  const [tasks, messages] = within(work).getAllByRole('listitem')
  expect(within(tasks!).getByRole('button', { name: '맡은 업무 없음' })).toBeTruthy()
  expect(within(tasks!).queryByText('지남')).toBeNull()
  expect(within(messages!).getByRole('button', { name: '안 읽은 메시지 없음' })).toBeTruthy()
  cleanup()
  open(memberHome())
  const loading = await card('내 업무·메시지')
  expect(within(loading).getByRole('button', { name: '안 읽은 방 집계 전' })).toBeTruthy()
})

test('막 들어온 운영진(직급도 부서도 없음): 부서 배정 전 띠 → 인사 카드 → 참여 행사 → 가까운 일정(학생회 행사) → 내 요청 → 내 업무·메시지', async () => {
  const event = { id: 'e1', name: '가을 축제' }
  open(
    memberHome({
      upcoming: {
        items: [{ kind: 'event_start', date: '2026-10-27', time: '10:00', event }],
        total: 1,
      },
    }),
    { view: memberView([]), rooms: roomsOf([room('notice')]) },
  )
  await card('김회장님, 안녕하세요')
  const band = screen.getByRole('status')
  expect(band.textContent).toBe('부서 배정 전 부서는 회장단이 정해요.')
  const order = [
    band,
    await card('김회장님, 안녕하세요'),
    await card('참여 행사 진행'),
    await card('가까운 일정'),
    await card('내 요청'),
    await card('내 업무·메시지'),
  ]
  for (let index = 1; index < order.length; index += 1)
    expect(
      order[index - 1]!.compareDocumentPosition(order[index]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  expect(within(order[2]!).getByText('회장단과 부서장이 만들어요')).toBeTruthy()
  expect(within(order[3]!).getByText('가을 축제')).toBeTruthy()
  expect(within(order[1]!).getByRole('button', { name: '공지방, 안 읽은 메시지 1개' })).toBeTruthy()
})

test('부서가 있는 부원에게는 부서 배정 전 띠가 없다', async () => {
  open(memberHome())
  await card('내 업무·메시지')
  expect(screen.queryByText('부서 배정 전')).toBeNull()
})
