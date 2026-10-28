import { dateFromKorean, koreanOf, type ScheduleItemDetail } from '@vada/contracts'
import { addDays } from './month-grid'

const HOUR_MS = 3_600_000
const compact = (value: string) => value.replaceAll('-', '').replaceAll(':', '')

export function googleCalendarUrl(item: ScheduleItemDetail, vadaUrl: string) {
  const end = item.allDay
    ? addDays(item.end ?? item.start, 1)
    : (item.end ?? koreanOf(new Date(dateFromKorean(item.start).getTime() + HOUR_MS)))
  const stamp = (value: string) => compact(value) + (item.allDay ? '' : '00')
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates: `${stamp(item.start)}/${stamp(end)}`,
    details: [item.memo, vadaUrl].filter(Boolean).join('\n'),
    location: item.place ?? '',
    ctz: 'Asia/Seoul',
  })
  return `https://calendar.google.com/calendar/render?${query}`
}
