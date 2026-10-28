import { KOREAN_DATE_LENGTH, type CalendarItem } from '@vada/contracts'
import { addDays } from '@/lib/month-grid'
import { rangeBarsOf } from '@/lib/range-bars'
import { dayLabel, monthOf, shiftMonth } from '@/tasks/calendar-month'

const YEAR_LENGTH = 4

const rangeOf = (item: CalendarItem) => ({
  from: item.start.slice(0, KOREAN_DATE_LENGTH),
  to: (item.end ?? item.start).slice(0, KOREAN_DATE_LENGTH),
})

export const itemsOn = (items: CalendarItem[], day: string) =>
  items.filter(item => {
    const { from, to } = rangeOf(item)
    return from <= day && day <= to
  })

export const barsOf = (items: CalendarItem[], week: string[]) => rangeBarsOf(items, week, rangeOf)

export const isMultiDay = (item: CalendarItem) => rangeOf(item).from !== rangeOf(item).to

export function monthGroupsOf(items: CalendarItem[], month: string) {
  const groups: { day: string; items: CalendarItem[] }[] = []
  const next = shiftMonth(month, 1)
  for (let day = `${month}-01`; monthOf(day) < next; day = addDays(day, 1)) {
    const onDay = itemsOn(items, day)
    if (onDay.length) groups.push({ day, items: onDay })
  }
  return groups
}

export function calendarDayLabel(day: string, today: string) {
  const year = day.slice(0, YEAR_LENGTH)
  return `${year === today.slice(0, YEAR_LENGTH) ? '' : `${year}년 `}${dayLabel(day)}`
}
