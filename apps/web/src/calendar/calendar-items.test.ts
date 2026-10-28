import { expect, test } from 'vitest'
import { calendarItem } from '@/test-support/calendar-fixtures'
import { weeksOf } from '@/tasks/calendar-month'
import { barsOf, itemsOn, monthGroupsOf } from './calendar-items'

test('여러 날 일정은 양 끝날을 포함하고 주 경계에서 자르며 겹치면 아래 막대다', () => {
  const long = calendarItem({ key: 'long', allDay: true, start: '2026-10-30', end: '2026-11-02' })
  const overlap = calendarItem({ key: 'overlap', start: '2026-10-31', end: '2026-11-01' })
  const [, , , , last = []] = weeksOf('2026-10')
  expect(
    barsOf([long, overlap], last).map(({ item, start, span, lane, before, after }) => [
      item.key,
      start,
      span,
      lane,
      before,
      after,
    ]),
  ).toEqual([
    ['long', 5, 2, 0, false, true],
    ['overlap', 6, 1, 1, false, true],
  ])
  const [first = []] = weeksOf('2026-11')
  expect(barsOf([long], first)[0]).toMatchObject({ start: 0, span: 2, before: true, after: false })
  expect(itemsOn([long], '2026-11-02')).toEqual([long])
  expect(itemsOn([long], '2026-11-03')).toEqual([])
})

test('목록은 달 바깥 날짜를 빼고 종일·시각 순서를 보존하며 걸친 날짜마다 묶는다', () => {
  const past = calendarItem({ key: 'outside', start: '2026-09-30' })
  const span = calendarItem({ key: 'span', start: '2026-09-30', end: '2026-10-02' })
  const timed = calendarItem({ key: 'timed', allDay: false, start: '2026-10-01T14:00' })
  const groups = monthGroupsOf([past, span, timed], '2026-10')
  expect(groups.map(({ day, items }) => [day, items.map(item => item.key)])).toEqual([
    ['2026-10-01', ['span', 'timed']],
    ['2026-10-02', ['span']],
  ])
})
