import {
  CreateMeetingSchema,
  KOREAN_DATE_LENGTH,
  MEETING_ATTENDEE_LIMIT,
  UpdateMeetingSchema,
  type CreateMeetingRequest,
  type MeetingDetail,
  type MeetingOptionsResponse,
} from '@vada/contracts'
import type { FieldErrors } from '@/lib/use-form-check'
import { MEETING_FIELD_ERROR } from './meeting-text'

export type AgendaDraft = { key: string; title: string; body: string }
export type MeetingFormValue = {
  type: 'council' | 'event'
  title: string
  purpose: string
  date: string
  start: string
  end: string
  place: string
  eventId: string
  hostDepartmentId: string
  attendeeIds: string[]
  agenda: AgendaDraft[]
  // 고치는 회의가 다음 날 끝나면 끝 날짜를 날짜 칸에서 며칠 뒤로 지킨다(폼은 날짜 칸 하나다).
  endDayOffset: number
}
const TIME_START = KOREAN_DATE_LENGTH + 1
function blankMeetingForm(memberId: string): MeetingFormValue {
  return {
    type: 'council',
    title: '',
    purpose: '',
    date: '',
    start: '',
    end: '',
    place: '',
    eventId: '',
    hostDepartmentId: '',
    attendeeIds: [memberId],
    agenda: [],
    endDayOffset: 0,
  }
}
function meetingLinks(
  item: MeetingDetail,
): Pick<MeetingFormValue, 'type' | 'eventId' | 'hostDepartmentId'> {
  return {
    type: item.event ? 'event' : 'council',
    eventId: item.event?.id ?? '',
    hostDepartmentId: item.hostDepartment?.id ?? '',
  }
}
export function initialMeetingForm(memberId: string, item?: MeetingDetail): MeetingFormValue {
  if (!item) return blankMeetingForm(memberId)
  return {
    ...blankMeetingForm(memberId),
    ...meetingLinks(item),
    title: item.title,
    purpose: item.purpose ?? '',
    date: item.heldAt.slice(0, KOREAN_DATE_LENGTH),
    start: item.heldAt.slice(TIME_START),
    end: item.endsAt?.slice(TIME_START) ?? '',
    endDayOffset: item.endsAt ? dayOffset(item.heldAt, item.endsAt) : 0,
    place: item.place ?? '',
    attendeeIds: item.attendees.map(person => person.id),
  }
}
const DAY_MS = 86_400_000
const dayOf = (time: string) => Date.parse(`${time.slice(0, KOREAN_DATE_LENGTH)}T00:00Z`)
function dayOffset(heldAt: string, endsAt: string) {
  return Math.round((dayOf(endsAt) - dayOf(heldAt)) / DAY_MS)
}
function endDateOf(value: MeetingFormValue) {
  const start = dayOf(value.date)
  if (!value.endDayOffset || Number.isNaN(start)) return value.date
  return new Date(start + value.endDayOffset * DAY_MS).toISOString().slice(0, KOREAN_DATE_LENGTH)
}
export function parseMeetingForm(value: MeetingFormValue, creatorId?: string | null) {
  return CreateMeetingSchema.safeParse({
    title: value.title,
    purpose: value.purpose.trim() || null,
    heldAt: `${value.date}T${value.start}`,
    endsAt: `${endDateOf(value)}T${value.end}`,
    place: value.place,
    eventId: value.type === 'event' ? value.eventId || null : null,
    hostDepartmentId: value.hostDepartmentId || null,
    attendeeIds: value.attendeeIds.filter(id => id !== creatorId),
    agenda: value.agenda.map(({ title, body }) => ({ title, body: body.trim() || null })),
  })
}
function contractErrors(value: MeetingFormValue, creatorId?: string | null): FieldErrors {
  const parsed = parseMeetingForm(value, creatorId)
  const errors: FieldErrors = {}
  for (const issue of parsed.error?.issues ?? []) {
    let key = issue.path.map(String).join('.')
    if (key === 'heldAt') key = value.date ? 'start' : 'date'
    if (key === 'endsAt') key = value.date ? 'end' : 'date'
    errors[key] ??= MEETING_FIELD_ERROR
  }
  return errors
}
function requiredMeetingFields(value: MeetingFormValue): FieldErrors {
  const errors: FieldErrors = {}
  for (const [key, label] of [
    ['title', '회의명을'],
    ['date', '날짜를'],
    ['start', '시작 시각을'],
    ['end', '끝 시각을'],
    ['place', '장소를'],
  ] as const) {
    if (!value[key].trim()) errors[key] = `${label} 입력해 주세요`
  }
  if (!value.endDayOffset && value.start && value.end && value.end <= value.start)
    errors.end = '끝은 시작보다 늦어야 해요.'
  if (value.type === 'event' && !value.eventId) errors.eventId = '연결 행사를 골라 주세요'
  return errors
}
// 서버는 만든 사람까지 세어 상한을 본다.
function attendeeLimitErrors(value: MeetingFormValue, creatorId?: string | null): FieldErrors {
  const people = new Set([...value.attendeeIds, ...(creatorId ? [creatorId] : [])])
  return people.size > MEETING_ATTENDEE_LIMIT ? { attendeeIds: '참가자가 너무 많아요' } : {}
}
export function meetingFormErrors(value: MeetingFormValue, creatorId?: string | null): FieldErrors {
  return {
    ...contractErrors(value, creatorId),
    ...attendeeLimitErrors(value, creatorId),
    ...requiredMeetingFields(value),
  }
}
const EDIT_FIELDS = [
  'title',
  'purpose',
  'heldAt',
  'endsAt',
  'place',
  'eventId',
  'hostDepartmentId',
] as const
type MeetingFields = Record<(typeof EDIT_FIELDS)[number], string | null>
export function meetingBase(item: MeetingDetail): MeetingFields {
  return {
    ...item,
    eventId: item.event?.id ?? null,
    hostDepartmentId: item.hostDepartment?.id ?? null,
  }
}
export function meetingUpdate(
  value: CreateMeetingRequest,
  previous: MeetingFields,
  versionNo: number,
) {
  const changed = Object.fromEntries(
    EDIT_FIELDS.filter(key => value[key] !== previous[key]).map(key => [key, value[key]]),
  )
  return UpdateMeetingSchema.safeParse({ ...changed, baseVersionNo: versionNo })
}
export const sameAttendees = (a: string[], b: string[]) =>
  a.length === b.length && a.every(id => b.includes(id))

const includeSelected = (
  choices: { id: string; name: string }[],
  selected: { id: string; name: string } | null | undefined,
) =>
  selected && !choices.some(choice => choice.id === selected.id) ? [selected, ...choices] : choices
export function meetingChoices(
  options: MeetingOptionsResponse,
  item?: MeetingDetail,
): MeetingOptionsResponse {
  const members = new Map(
    [...(item?.attendees ?? []), ...options.members].map(person => [person.id, person]),
  )
  return {
    ...options,
    events: includeSelected(options.events, item?.event),
    departments: includeSelected(options.departments, item?.hostDepartment),
    members: [...members.values()],
  }
}
