import {
  CreateMeetingSchema,
  KOREAN_DATE_LENGTH,
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
    place: item.place ?? '',
    attendeeIds: item.attendees.map(person => person.id),
  }
}
export function parseMeetingForm(value: MeetingFormValue, creatorId?: string | null) {
  return CreateMeetingSchema.safeParse({
    title: value.title,
    purpose: value.purpose.trim() || null,
    heldAt: `${value.date}T${value.start}`,
    endsAt: `${value.date}T${value.end}`,
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
  if (value.start && value.end && value.end <= value.start)
    errors.end = '끝은 시작보다 늦어야 해요.'
  if (value.type === 'event' && !value.eventId) errors.eventId = '연결 행사를 골라 주세요'
  return errors
}
export function meetingFormErrors(value: MeetingFormValue, creatorId?: string | null): FieldErrors {
  return { ...contractErrors(value, creatorId), ...requiredMeetingFields(value) }
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
