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

test('안 읽은 1:1을 최근 순으로 먼저, 남은 자리에 다른 방을 최근 순으로, 3개까지 둔다', async () => {
  open(
    roomsOf([
      room('notice', { unread: 5, lastMessageAt: at(11) }),
      room('lead', { type: 'leadership', unread: 0, lastMessageAt: at(12) }),
      room('plan', { type: 'department', name: '기획부', unread: 2, lastMessageAt: at(10) }),
      room('kim', { type: 'direct', name: '김민준', unread: 1, lastMessageAt: at(8) }),
      room('park', { type: 'direct', name: '박새내', unread: 120, lastMessageAt: at(9) }),
    ]),
  )
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  expect(chipNames(inbox)).toEqual(['박새내 · 1:1 99+', '김민준 · 1:1 1', '공지방 5', '전체 보기'])
})

test('부서 간 방도 1:1과 같이 먼저 둔다', async () => {
  open(
    roomsOf([
      room('notice', { unread: 1, lastMessageAt: at(12) }),
      room('plan', { type: 'department', name: '기획부', unread: 1, lastMessageAt: at(11) }),
      room('between', { type: 'inter_department', unread: 1, lastMessageAt: at(7) }),
      room('kim', { type: 'direct', name: '김민준', unread: 1, lastMessageAt: at(8) }),
    ]),
  )
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  expect(chipNames(inbox)).toEqual(['김민준 · 1:1 1', '부서 간 대화 1', '공지방 1', '전체 보기'])
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
  fireEvent.click(within(inbox).getByRole('button', { name: '기획부 2' }))
  expect(window.location.pathname).toBe('/chat/c1/r9')
  fireEvent.click(within(inbox).getByRole('button', { name: '전체 보기' }))
  expect(window.location.pathname).toBe('/chat/c1')
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
