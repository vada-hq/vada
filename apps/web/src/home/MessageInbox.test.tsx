// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { room } from '@/test-support/chat-fixtures'
import { councilView } from '@/test-support/council-fixtures'
import { homeResponse, noRooms, onHomeExtras, roomsOf } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import type { RoomListState } from '@/chat/useRoomList'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

// 홈 메시지함(DEC-90): 작업 공간이 읽은 대화 목록에서 안 읽은 방 칩 3개와 '전체 보기'.
function open(rooms: RoomListState) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/home', () => json(homeResponse()))
  onHomeExtras(api)
  render(
    <HomePage
      view={councilView('c1')}
      rooms={rooms}
      onForbidden={vi.fn()}
      onOpenEvent={vi.fn()}
      onOpenPage={vi.fn()}
    />,
  )
}

const chipNames = (inbox: HTMLElement) =>
  within(inbox)
    .getAllByRole('button')
    .map(item => item.textContent)

const at = (hour: number) => `2026-10-23T${String(hour).padStart(2, '0')}:00:00.000Z`

// 각 묶음 안의 차례가 최근 순이고 안 읽은 수 순이 아님을 가르도록, 두 차례가 다른 자료로 둔다.
test('안 읽은 1:1을 최근 순으로 먼저, 남은 자리에 다른 방을 최근 순으로, 3개까지 둔다', async () => {
  open(
    roomsOf([
      room('notice', { unread: 5, lastMessageAt: at(10) }),
      room('lead', { type: 'leadership', unread: 0, lastMessageAt: at(12) }),
      room('plan', { type: 'department', name: '기획부', unread: 2, lastMessageAt: at(11) }),
      room('park', { type: 'direct', name: '박새내', unread: 120, lastMessageAt: at(8) }),
      room('kim', { type: 'direct', name: '김민준', unread: 1, lastMessageAt: at(9) }),
    ]),
  )
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  expect(chipNames(inbox)).toEqual(['김민준 · 1:1 1', '박새내 · 1:1 99+', '기획부 2', '전체 보기'])
})

test('1:1 다음에 부서 간 방, 그다음 다른 방이다(부서 간 방이 더 최근이어도)', async () => {
  open(
    roomsOf([
      room('notice', { unread: 1, lastMessageAt: at(12) }),
      room('plan', { type: 'department', name: '기획부', unread: 1, lastMessageAt: at(11) }),
      room('between', { type: 'inter_department', unread: 1, lastMessageAt: at(9) }),
      room('kim', { type: 'direct', name: '김민준', unread: 1, lastMessageAt: at(7) }),
    ]),
  )
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  expect(chipNames(inbox)).toEqual(['김민준 · 1:1 1', '부서 간 대화 1', '공지방 1', '전체 보기'])
})

test('상대 이름이 없는 1:1은 이름을 겹치지 않는다', async () => {
  open(roomsOf([room('x', { type: 'direct', name: null, unread: 1 })]))
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  expect(chipNames(inbox)).toEqual(['1:1 대화 1', '전체 보기'])
})

test('칩의 접근 이름은 방 이름과 안 읽은 수의 뜻이다(옆 메뉴 배지와 같은 말)', async () => {
  open(roomsOf([room('lead', { type: 'leadership', unread: 2 })]))
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  expect(within(inbox).getByRole('button', { name: '회장단방, 안 읽은 메시지 2개' })).toBeTruthy()
})

test('메시지함은 숫자 카드 바로 아래에 있다', async () => {
  open(roomsOf([room('notice', { unread: 1 })]))
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  const tiles = screen.getByRole('region', { name: '지금 볼 것' })
  const mine = screen.getByRole('region', { name: '내 업무' })
  expect(tiles.nextElementSibling).toBe(inbox)
  expect(inbox.compareDocumentPosition(mine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('칩을 누르면 그 방이 열린 대화 화면, 전체 보기는 대화 방 목록이다', async () => {
  open(roomsOf([room('r9', { type: 'department', name: '기획부', unread: 2 })]))
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  fireEvent.click(within(inbox).getByRole('button', { name: '기획부, 안 읽은 메시지 2개' }))
  expect(window.location.pathname).toBe('/chat/c1/r9')
  fireEvent.click(within(inbox).getByRole('button', { name: '전체 보기' }))
  expect(window.location.pathname).toBe('/chat/c1')
})

test('행사 방 칩은 해당 행사의 메시지 탭에서 그 방을 연다', async () => {
  const eventId = '00000000-0000-4000-8000-0000000000e1'
  const roomId = '00000000-0000-4000-8000-0000000000a1'
  open(roomsOf([room(roomId, { eventId, eventName: '체육대회', unread: 2 })]))
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  fireEvent.click(
    within(inbox).getByRole('button', { name: '체육대회 공지방, 안 읽은 메시지 2개' }),
  )
  expect(window.location.pathname + window.location.search).toBe(
    `/events/c1/${eventId}?room=${roomId}`,
  )
})

test.each([
  [
    '안 읽은 방이 없으면',
    roomsOf([room('notice'), room('kim', { type: 'direct', name: '김민준' })]),
  ],
  ['목록을 읽지 못했으면', { kind: 'failed' } as const],
  ['목록을 읽는 중이면', noRooms],
])('%s 메시지함이 없고 다른 부분은 그대로다', async (_, rooms) => {
  open(rooms)
  await screen.findByRole('region', { name: '내 업무' })
  expect(screen.getByRole('region', { name: '지금 볼 것' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: '메시지함' })).toBeNull()
})
