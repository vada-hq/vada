import { expect, test } from 'vitest'
import type { RoomSummary } from '@vada/contracts'
import { firstRoomOf, shownRoomOf, switchRooms, unreadSum } from './space-rooms'

const room = (id: string, extra: Partial<RoomSummary>): RoomSummary => ({
  id,
  type: 'department',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 0,
  mentions: 0,
  lastMessageAt: null,
  lastMessage: null,
  memberCount: 2,
  eventId: 'e1',
  eventName: '봄 축제',
  ...extra,
})

const notice = room('n', { type: 'all_members', unread: 2 })
const plan = room('p', { name: '기획부', unread: 3 })
const money = room('m', { name: '재정부' })

test('방 전환은 공지방이 맨 앞이고 부서방은 받은 차례다', () => {
  expect(switchRooms([plan, money, notice]).map(item => item.id)).toEqual(['n', 'p', 'm'])
})

test('처음 여는 방은 회장단방, 내 부서방, 공지방 차례다', () => {
  expect(firstRoomOf([notice, plan, money])?.id).toBe('p')
  expect(firstRoomOf([notice])?.id).toBe('n')
  expect(firstRoomOf([notice, plan, room('l', { type: 'leadership' })])?.id).toBe('l')
  expect(firstRoomOf([])).toBeNull()
})

test('주소의 방이 이 공간의 방이 아니면 처음 여는 방이다', () => {
  expect(shownRoomOf([notice, plan], 'n')?.id).toBe('n')
  expect(shownRoomOf([notice, plan], 'other')?.id).toBe('p')
  expect(shownRoomOf([notice, plan], null)?.id).toBe('p')
})

test('탭 배지는 방마다 안 읽은 수의 합이다', () => {
  expect(unreadSum([notice, plan, money])).toBe(5)
  expect(unreadSum([])).toBe(0)
})
