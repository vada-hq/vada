import {
  dateFromKorean,
  dayLabel,
  dayTimeLabel,
  KOREAN_DATE_LENGTH,
  type ScheduleItemDetail,
} from '@vada/contracts'

const TIME_FROM = KOREAN_DATE_LENGTH + 1
const dateLabel = (date: string) => dayLabel(dateFromKorean(`${date}T00:00`).toISOString())

export function scheduleDateLabel(item: ScheduleItemDetail) {
  if (item.allDay) {
    const start = dateLabel(item.start)
    return item.end && item.end !== item.start ? `${start} ~ ${dateLabel(item.end)}` : start
  }
  const start = dayTimeLabel(dateFromKorean(item.start).toISOString())
  if (!item.end) return start
  const end =
    item.start.slice(0, KOREAN_DATE_LENGTH) === item.end.slice(0, KOREAN_DATE_LENGTH)
      ? item.end.slice(TIME_FROM)
      : dayTimeLabel(dateFromKorean(item.end).toISOString())
  return `${start} ~ ${end}`
}

export const scheduleCreator = (item: ScheduleItemDetail) =>
  `${item.createdBy?.name ?? '떠난 운영진'} · ${dayLabel(item.createdAt)}`
