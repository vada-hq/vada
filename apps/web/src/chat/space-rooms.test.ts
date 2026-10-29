import { expect, test } from 'vitest'
import type { RoomSummary } from '@vada/contracts'
import {
  councilRooms,
  directRooms,
  elsewhereRooms,
  firstRoomOf,
  shownRoomOf,
  switchRooms,
  unreadSum,
} from './space-rooms'

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

test('방 탭은 공지방이 맨 앞이고 부서방은 받은 차례다', () => {
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

test('학생회 탭에는 서버가 준 학생회 공지·회장단·부서 방만 남긴다', () => {
  const ownNotice = { ...notice, eventId: null }
  const ownDepartment = { ...plan, eventId: null }
  const leadership = room('l', { type: 'leadership', eventId: null })
  const direct = room('d', { type: 'direct', eventId: null })
  const between = room('b', { type: 'inter_department', eventId: null })
  expect(councilRooms([ownNotice, ownDepartment, leadership, notice, direct, between])).toEqual([
    ownNotice,
    ownDepartment,
    leadership,
  ])
})
test('1:1은 전부 보이고 안 읽은 방 먼저, 같은 묶음에서는 최근 순이며 날짜가 없으면 뒤다', () => {
  const direct = (id: string, unread: number, lastMessageAt: string | null) =>
    room(id, { type: 'direct', unread, lastMessageAt })
  const rooms = [
    direct('read', 0, '2026-10-29T01:00:00Z'),
    direct('old', 3, '2026-10-27T01:00:00Z'),
    direct('empty', 0, null),
    room('notice', {}),
    direct('new', 1, '2026-10-28T01:00:00Z'),
  ]
  expect(directRooms(rooms).map(item => item.id)).toEqual(['new', 'old', 'read', 'empty'])
  expect(rooms[0]?.id).toBe('read')
})

test('탭 줄에 없는 방(행사·부서 간)만 전체 보기 몫이고, 탭·1:1·전체 보기 몫을 더하면 모든 방의 안 읽은 수다', () => {
  const ownNotice = room('on', { type: 'all_members', eventId: null, unread: 1 })
  const leadership = room('l', { type: 'leadership', eventId: null, unread: 2 })
  const ownDepartment = room('od', { eventId: null, unread: 4 })
  const direct = room('d', { type: 'direct', eventId: null, unread: 8 })
  const between = room('b', { type: 'inter_department', eventId: null, unread: 16 })
  const rooms = [ownNotice, leadership, ownDepartment, notice, plan, direct, between]
  expect(elsewhereRooms(rooms)).toEqual([notice, plan, between])
  expect(
    unreadSum(councilRooms(rooms)) +
      unreadSum(directRooms(rooms)) +
      unreadSum(elsewhereRooms(rooms)),
  ).toBe(unreadSum(rooms))
})
