import { expect, test } from 'vitest'
import { message } from '@/test-support/chat-fixtures'
import { CONTINUE_MS, dayLabel, firstUnreadId, flowOf } from './message-flow'

const now = new Date('2026-10-21T03:00:00Z') // 한국 10-21(수) 12:00
const at = (iso: string, id: string, senderId = 'm2') => message(id, id, { sentAt: iso, senderId })

test('날짜 구분선은 오늘, 어제, 그 전은 날짜와 요일이다(한국 날짜)', () => {
  expect(dayLabel('2026-10-21T00:00:00Z', now)).toBe('오늘')
  expect(dayLabel('2026-10-20T03:00:00Z', now)).toBe('어제')
  expect(dayLabel('2026-10-19T03:00:00Z', now)).toBe('10월 19일 (월)')
  expect(dayLabel('2026-10-20T15:30:00Z', now)).toBe('오늘') // 한국 10-21 00:30
})

test('처음 안 읽은 메시지는 끝에서 남의 메시지를 안 읽은 수만큼 거슬러 간 자리다', () => {
  const messages = [
    at('2026-10-21T01:00:00Z', 'a1'),
    at('2026-10-21T01:01:00Z', 'a2'),
    at('2026-10-21T01:02:00Z', 'mine', 'm1'),
    at('2026-10-21T01:03:00Z', 'a3'),
  ]
  expect(firstUnreadId(messages, 2, 'm1')).toBe('a2')
  expect(firstUnreadId(messages, 0, 'm1')).toBeNull()
  expect(firstUnreadId(messages, 9, 'm1')).toBeNull()
})

test('같은 사람이 5분 안에 이어 쓰면 묶고, 사람·날짜·새 메시지 경계가 바뀌면 끊는다', () => {
  const start = Date.parse('2026-10-20T14:49:00Z')
  const iso = (ms: number) => new Date(start + ms).toISOString()
  const items = flowOf(
    [
      at(iso(0), 'a1'),
      at(iso(CONTINUE_MS - 1), 'a2'),
      at(iso(CONTINUE_MS * 2), 'a3'), // 5분 넘게 뒤
      at(iso(CONTINUE_MS * 2 + 1), 'b1', 'm3'), // 다른 사람
      at(iso(CONTINUE_MS * 2 + 60_001), 'b2', 'm3'), // 한국 자정(15:00Z)을 넘었다
      at(iso(CONTINUE_MS * 2 + 60_002), 'b3', 'm3'),
    ],
    now,
    'b3',
  )
  expect(
    items.map(item => (item.kind === 'message' ? `${item.key}:${item.continued}` : item.kind)),
  ).toEqual([
    'date',
    'a1:false',
    'a2:true',
    'a3:false',
    'b1:false',
    'date',
    'b2:false',
    'unread',
    'b3:false',
  ])
})
