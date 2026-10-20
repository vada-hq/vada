import { expect, test } from 'vitest'
import { dateLabel, roomName, timeLabel, unreadLabel } from './chat-view'

const now = new Date('2026-10-21T03:00:00Z') // 한국 12:00

test('안 읽은 수는 99를 넘으면 99+다', () => {
  expect(unreadLabel(99)).toBe('99')
  expect(unreadLabel(100)).toBe('99+')
})

test('마지막 시각은 한국 날짜가 같으면 시각, 아니면 날짜다', () => {
  expect(timeLabel('2026-10-21T01:30:00Z', now)).toBe('10:30')
  expect(timeLabel('2026-10-20T08:00:00Z', now)).toBe('10월 20일')
  expect(timeLabel(null, now)).toBe('')
})

test('한국 자정 앞뒤 1초는 날짜가 갈린다', () => {
  const after = new Date('2026-10-21T15:00:00Z') // 한국 10-22 00:00:00
  expect(timeLabel('2026-10-21T14:59:59Z', after)).toBe('10월 21일')
  expect(timeLabel('2026-10-21T15:00:01Z', after)).toBe('00:00')
  const before = new Date('2026-10-21T14:59:59Z')
  expect(timeLabel('2026-10-21T14:59:58Z', before)).toBe('23:59')
})

test('지난해 시각은 연도를 붙인다', () => {
  expect(dateLabel('2025-12-31T14:59:59Z', now)).toBe('2025년 12월 31일')
  expect(dateLabel('2025-12-31T15:00:01Z', now)).toBe('1월 1일')
})

test('방 이름은 종류로 붙이고, 부서와 1:1은 받은 이름이다', () => {
  expect(roomName({ type: 'all_members', name: null })).toBe('운영진 전체방')
  expect(roomName({ type: 'leadership', name: null })).toBe('회장단방')
  expect(roomName({ type: 'department', name: '재정부' })).toBe('재정부')
  expect(roomName({ type: 'direct', name: '박새내' })).toBe('박새내')
  expect(roomName({ type: 'direct', name: null })).toBe('1:1 대화')
})
