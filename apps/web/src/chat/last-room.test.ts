import { expect, test } from 'vitest'
import { room, roomList } from '@/test-support/chat-fixtures'
import { roomToShow } from './last-room'

test('열어 둘 방은 기억한 방이 목록에 있으면 그 방, 아니면 1:1이 아닌 첫 방이다', () => {
  const data = roomList({
    rooms: [room('d1', { type: 'direct', name: '박새내' }), room('r1'), room('r2')],
  })
  expect(roomToShow(data, 'r2')).toBe('r2')
  expect(roomToShow(data, 'gone')).toBe('r1')
  expect(roomToShow(data, null)).toBe('r1')
  expect(roomToShow(roomList({ rooms: [room('d1', { type: 'direct' })] }), null)).toBe('d1')
  expect(roomToShow(roomList({ rooms: [] }), null)).toBeNull()
})
