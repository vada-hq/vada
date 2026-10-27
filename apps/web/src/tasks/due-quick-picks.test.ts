import { expect, test } from 'vitest'
import { quickDuePicks } from './due-quick-picks'

test('빠른 날은 오늘, 내일, 다음 주 월요일이다', () => {
  // 2026-10-27은 화요일
  expect(quickDuePicks('2026-10-27').map(pick => pick.date)).toEqual([
    '2026-10-27',
    '2026-10-28',
    '2026-11-02',
  ])
})

test('오늘이 월요일이면 다음 주 월요일은 이레 뒤, 일요일이면 다음 날이다', () => {
  expect(quickDuePicks('2026-10-26')[2]?.date).toBe('2026-11-02')
  expect(quickDuePicks('2026-11-01')[2]?.date).toBe('2026-11-02')
})
