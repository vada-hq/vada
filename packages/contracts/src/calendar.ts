import { z } from 'zod'
import {
  DAY_MS,
  dateFromKorean,
  koreanDate,
  koreanDateTime,
  KOREAN_DATE_LENGTH,
} from './korean-time.js'
import { EmptyRequestSchema, text } from './input.js'
import { recordIdInput } from './team.js'

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

const ScheduleWhenSchema = z.discriminatedUnion('allDay', [
  z.strictObject({ allDay: z.literal(true), startsOn: koreanDate, endsOn: koreanDate.nullable() }),
  z.strictObject({
    allDay: z.literal(false),
    startsAt: koreanDateTime,
    endsAt: koreanDateTime.nullable(),
  }),
])
const scheduleFields = {
  title: text(SCHEDULE_TITLE_MAX),
  type: z.enum(SCHEDULE_TYPES),
  when: ScheduleWhenSchema,
  place: text(SCHEDULE_PLACE_MAX).nullable(),
  departmentId: recordIdInput.nullable(),
  visibility: z.enum(SCHEDULE_VISIBILITIES),
  eventId: recordIdInput.nullable(),
  memo: text(SCHEDULE_MEMO_MAX).nullable(),
}

function validSpan({ when }: { when: z.infer<typeof ScheduleWhenSchema> }) {
  const start = when.allDay ? when.startsOn : when.startsAt
  const end = when.allDay ? when.endsOn : when.endsAt
  if (end === null) return true
  const ordered = when.allDay ? end >= start : end > start
  const day = (value: string) =>
    dateFromKorean(`${value.slice(0, KOREAN_DATE_LENGTH)}T00:00`).getTime()
  return ordered && (day(end) - day(start)) / DAY_MS <= SCHEDULE_SPAN_MAX_DAYS
}

const departmentWhenScoped = (input: {
  visibility: ScheduleVisibility
  departmentId: string | null
}) => input.visibility !== 'department' || input.departmentId !== null

export const CreateScheduleItemSchema = z
  .strictObject({
    ...scheduleFields,
    type: scheduleFields.type.default('other'),
    place: scheduleFields.place.default(null),
    departmentId: scheduleFields.departmentId.default(null),
    visibility: scheduleFields.visibility.default('council'),
    eventId: scheduleFields.eventId.default(null),
    memo: scheduleFields.memo.default(null),
  })
  .refine(validSpan, { path: ['when'] })
  .refine(departmentWhenScoped, { path: ['departmentId'] })
export const UpdateScheduleItemSchema = z
  .strictObject(scheduleFields)
  .refine(validSpan, { path: ['when'] })
  .refine(departmentWhenScoped, { path: ['departmentId'] })
export const DeleteScheduleItemSchema = EmptyRequestSchema
export type CreateScheduleItemRequest = z.infer<typeof CreateScheduleItemSchema>
export type UpdateScheduleItemRequest = z.infer<typeof UpdateScheduleItemSchema>

// 일정 상세가 주는 동작. 이름은 권한 키(schedule.update·schedule.delete)와 떼어 둔다(web structure/actions-reach.test.ts).
export const SCHEDULE_ACTIONS = ['schedule_item.update', 'schedule_item.cancel'] as const
export type ScheduleAction = (typeof SCHEDULE_ACTIONS)[number]
export interface ScheduleItemDetail {
  id: string
  title: string
  type: ScheduleType
  allDay: boolean
  start: string
  end: string | null
  place: string | null
  memo: string | null
  visibility: ScheduleVisibility
  department: { id: string; name: string } | null
  event: { id: string; name: string } | null
  createdBy: { id: string; name: string | null; current: boolean } | null
  createdAt: string
  actions: ScheduleAction[]
}
export interface ScheduleItemResponse {
  item: ScheduleItemDetail
}

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

export const CALENDAR_KIND_LABELS = {
  event: '행사',
  meeting: '회의',
  deadline: '마감',
  academic: '시험·학사',
  external: '외부',
  other: '기타',
} as const satisfies Record<CalendarKind, string>

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
