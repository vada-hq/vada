import { z } from 'zod'
import { DAY_MS, dateFromKorean, koreanDate } from './korean-time.js'

export const SCHEDULE_TITLE_MAX = 100
export const SCHEDULE_PLACE_MAX = 100
export const SCHEDULE_MEMO_MAX = 1000
export const SCHEDULE_SPAN_MAX_DAYS = 366
// 양 끝을 포함한다. 월 칸 여섯 주를 넉넉히 담는다(DEC-102).
export const CALENDAR_RANGE_MAX_DAYS = 92
export const CALENDAR_ITEM_LIMIT = 500

export const SCHEDULE_TYPES = ['deadline', 'academic', 'external', 'other'] as const
export type ScheduleType = (typeof SCHEDULE_TYPES)[number]
export const SCHEDULE_VISIBILITIES = ['council', 'department'] as const
export type ScheduleVisibility = (typeof SCHEDULE_VISIBILITIES)[number]

export const CALENDAR_KINDS = [
  'event',
  'meeting',
  'deadline',
  'academic',
  'external',
  'other',
] as const
export type CalendarKind = (typeof CALENDAR_KINDS)[number]
export const CALENDAR_SOURCES = [
  'event',
  'task_due',
  'registration_close',
  'purchase_needed_by',
  'meeting',
  'schedule_item',
] as const
export type CalendarSource = (typeof CALENDAR_SOURCES)[number]

export const CALENDAR_KIND_LABELS: Record<CalendarKind, string> = {
  event: '행사',
  meeting: '회의',
  deadline: '마감',
  academic: '시험·학사',
  external: '외부',
  other: '기타',
}

export const CalendarQuerySchema = z
  .strictObject({ from: koreanDate, to: koreanDate })
  .refine(q => {
    const span =
      (dateFromKorean(`${q.to}T00:00`).getTime() - dateFromKorean(`${q.from}T00:00`).getTime()) /
        DAY_MS +
      1
    return q.to >= q.from && span <= CALENDAR_RANGE_MAX_DAYS
  })

export type CalendarTarget =
  | { record: 'events'; id: string; tab: 'overview' | 'registrations' }
  | { record: 'tasks'; id: string }
  | { record: 'purchases'; id: string }
  | { record: 'schedule'; id: string }
  | { record: 'meetings'; id: string }

export interface CalendarItem {
  key: string
  source: CalendarSource
  kind: CalendarKind
  title: string
  allDay: boolean
  // 종일이면 한국 날짜(끝 날 포함), 아니면 한국 시각이다. 끝이 없으면 한 날·한 시점이다.
  start: string
  end: string | null
  place: string | null
  event: { id: string; name: string } | null
  department: { id: string; name: string } | null
  mine: boolean
  overdue: boolean
  target: CalendarTarget
}

export interface CalendarResponse {
  items: CalendarItem[]
  truncated: boolean
}

export function calendarTitleOf(item: CalendarItem): string {
  if (item.source === 'registration_close') return `${item.title} 신청 마감`
  if (item.source === 'purchase_needed_by') return `${item.title} 필요`
  return item.title
}
