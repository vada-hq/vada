import { expect, test } from 'vitest'
import { room, roomList } from '@/test-support/chat-fixtures'
import { roomToShow } from './last-room'

const notice = room('all')
const leadership = room('lead', { type: 'leadership' })
const planning = room('plan', { type: 'department', name: '기획부', departmentId: 'd1' })
const finance = room('fin', { type: 'department', name: '재정부', departmentId: 'd2' })
const direct = room('d1', { type: 'direct', name: '박새내' })
const listOf = (...rooms: ReturnType<typeof room>[]) => roomList({ rooms })

test('기억한 학생회 방이 아직 목록에 있으면 그 방이고, 기억한 1:1은 첫 학생회 방으로 돌아간다', () => {
  expect(roomToShow(listOf(notice, leadership, planning, direct), 'd1')).toBe('lead')
  expect(roomToShow(listOf(notice, leadership, planning), 'all')).toBe('all')
})

// 방 목록은 내가 든 방만 있다. 회장단방은 학생회 직급, 부서방은 부서 소속이 있어야 든다(DEC-18).
test('기억한 방이 없으면 회장단은 회장단방, 부서원은 방 차례의 첫 부서방, 부서가 없으면 공지방이다(DEC-90)', () => {
  expect(roomToShow(listOf(notice, leadership, planning), null)).toBe('lead')
  expect(roomToShow(listOf(notice, planning, finance, direct), null)).toBe('plan')
  expect(roomToShow(listOf(notice, direct), null)).toBe('all')
})

test('기억한 방에서 빠졌으면 같은 차례로 고른다', () => {
  expect(roomToShow(listOf(notice, finance), 'lead')).toBe('fin')
  expect(roomToShow(listOf(notice), 'plan')).toBe('all')
})

test('학생회 방이 없으면 1:1을 자동으로 열지 않는다', () => {
  expect(roomToShow(listOf(direct), null)).toBeNull()
  expect(roomToShow(listOf(), null)).toBeNull()
})

test('기억한 행사 방은 메시지 메뉴에서 다시 열지 않고 학생회 방으로 돌아간다', () => {
  const event = room('event', { eventId: 'e1' })
  expect(roomToShow(listOf(event, notice, leadership), 'event')).toBe('lead')
  expect(roomToShow(listOf(event), 'event')).toBeNull()
})
