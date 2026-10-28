import { DAY_MS, dateFromKorean } from '@vada/contracts'

export type CalendarRange = { from: Date; until: Date }

// 한국에는 일광절약시간이 없어 마지막 날 0시에 하루를 더하면 다음 날 0시다.
export function calendarRangeOf(query: { from: string; to: string }): CalendarRange {
  return {
    from: dateFromKorean(`${query.from}T00:00`),
    until: new Date(dateFromKorean(`${query.to}T00:00`).getTime() + DAY_MS),
  }
}
