import {
  CreateScheduleItemSchema,
  UpdateScheduleItemSchema,
  KOREAN_DATE_LENGTH,
  type ScheduleItemDetail,
  type ScheduleType,
  type ScheduleVisibility,
} from '@vada/contracts'
import { requiredText, type FieldErrors } from '@/lib/use-form-check'

export type ScheduleForm = {
  title: string
  type: ScheduleType
  allDay: boolean
  start: string
  end: string
  place: string
  departmentId: string
  visibility: ScheduleVisibility
  eventId: string
  memo: string
}
export type ScheduleChoice = { id: string; name: string; disabled?: boolean }
export type ScheduleSaveProblem = { departmentId?: string; form?: string }
export type ScheduleFieldProps = {
  value: ScheduleForm
  errors: FieldErrors
  onChange: (patch: Partial<ScheduleForm>) => void
}

const blankSchedule = (date: string): ScheduleForm => ({
  title: '',
  type: 'other',
  allDay: true,
  start: date,
  end: '',
  place: '',
  departmentId: '',
  visibility: 'council',
  eventId: '',
  memo: '',
})

export function initialSchedule(date: string, item?: ScheduleItemDetail): ScheduleForm {
  if (!item) return blankSchedule(date)
  return {
    title: item.title,
    type: item.type,
    allDay: item.allDay,
    start: item.start,
    end: item.end ?? '',
    place: item.place ?? '',
    departmentId: item.department?.id ?? '',
    visibility: item.visibility,
    eventId: item.event?.id ?? '',
    memo: item.memo ?? '',
  }
}

const optional = (value: string) => value.trim() || null
export function parseSchedule(value: ScheduleForm, editing: boolean) {
  const schema = editing ? UpdateScheduleItemSchema : CreateScheduleItemSchema
  return schema.safeParse({
    title: value.title,
    type: value.type,
    when: value.allDay
      ? { allDay: true, startsOn: value.start, endsOn: optional(value.end) }
      : { allDay: false, startsAt: value.start, endsAt: optional(value.end) },
    place: optional(value.place),
    departmentId: optional(value.departmentId),
    visibility: value.departmentId ? value.visibility : 'council',
    eventId: optional(value.eventId),
    memo: optional(value.memo),
  })
}

export function scheduleErrors(value: ScheduleForm, editing: boolean): FieldErrors {
  const parsed = parseSchedule(value, editing)
  const errors: FieldErrors = {}
  for (const issue of parsed.error?.issues ?? []) {
    const key = issue.path[0] === 'when' ? whenField(issue.path) : String(issue.path[0])
    errors[key] ??= fieldProblem(key)
  }
  if (!value.title.trim()) errors.title = requiredText(value.title, '제목을')
  if (!value.start) errors.start = `${value.allDay ? '시작 날짜를' : '시작 시각을'} 입력해 주세요`
  return errors
}

const fieldProblem = (key: string) =>
  key === 'start' || key === 'end'
    ? '날짜와 시각, 시작과 끝의 순서·기간을 확인해 주세요.'
    : '길이나 입력한 글자를 확인해 주세요.'

function whenField(path: readonly PropertyKey[]) {
  return String(path[1]).startsWith('starts') ? 'start' : 'end'
}

// 종일을 바꿔도 고른 날짜는 보존한다. 시각을 처음 고를 때는 업무 시작 시각을 둔다.
export function toggleAllDay(value: ScheduleForm, allDay: boolean): Partial<ScheduleForm> {
  const convert = (date: string) =>
    date ? date.slice(0, KOREAN_DATE_LENGTH) + (allDay ? '' : 'T09:00') : ''
  return { allDay, start: convert(value.start), end: convert(value.end) }
}
