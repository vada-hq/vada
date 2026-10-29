import { z } from 'zod'
import { codePoints, nulOrLoneSurrogate, text } from './input.js'
import { koreanDate, koreanDateTime } from './korean-time.js'
import { recordIdInput } from './team.js'
import type { TaskStatus } from './tasks.js'

export const MEETING_TITLE_MAX = 100
export const MEETING_PLACE_MAX = 100
export const MEETING_PURPOSE_MAX = 500
export const MEETING_CANCEL_REASON_MAX = 200
export const MEETING_AMEND_REASON_MAX = MEETING_CANCEL_REASON_MAX
export const MEETING_AGENDA_TITLE_MAX = MEETING_TITLE_MAX
export const MEETING_AGENDA_BODY_MAX = 500
export const MEETING_AGENDA_LIMIT = 30
export const MEETING_ATTENDEE_LIMIT = 200
export const MEETING_LIST_LIMIT = 300
export const MEETING_NOTES_MAX = 10000
export const MEETING_DECISION_MAX = 500

export const MEETING_STATUSES = [
  'scheduled',
  'in_progress',
  'wrapping_up',
  'done',
  'cancelled',
] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]
// 회의가 주는 동작. 이름은 권한 키(meeting.write 등)와 떼어 둔다(web structure/actions-reach.test.ts).
export const MEETING_ACTIONS = [
  'meeting.edit',
  'meeting.cancel',
  'meeting.minutes',
  'meeting.confirm',
  'meeting.amend',
] as const
export type MeetingAction = (typeof MEETING_ACTIONS)[number]
export type MeetingRelation = 'manager' | 'attendee' | 'none'
export type MeetingMinutesStatus = 'none' | 'draft' | 'confirmed'

const attendeeIds = z.array(recordIdInput).max(MEETING_ATTENDEE_LIMIT)
const agendaInput = z.strictObject({
  title: text(MEETING_AGENDA_TITLE_MAX),
  body: text(MEETING_AGENDA_BODY_MAX).nullable().default(null),
})
const fields = {
  title: text(MEETING_TITLE_MAX),
  heldAt: koreanDateTime,
  endsAt: koreanDateTime,
  place: text(MEETING_PLACE_MAX),
  purpose: text(MEETING_PURPOSE_MAX).nullable(),
  eventId: recordIdInput.nullable(),
  hostDepartmentId: recordIdInput.nullable(),
}
export const CreateMeetingSchema = z
  .strictObject({
    ...fields,
    purpose: fields.purpose.default(null),
    eventId: fields.eventId.default(null),
    hostDepartmentId: fields.hostDepartmentId.default(null),
    attendeeIds: attendeeIds.default([]),
    agenda: z.array(agendaInput).max(MEETING_AGENDA_LIMIT).default([]),
  })
  .refine(input => input.endsAt > input.heldAt, { path: ['endsAt'] })

const VERSION_NO_MAX = 2_147_483_647
const baseVersionNo = z.int().min(1).max(VERSION_NO_MAX)
// 자동 저장하는 글은 자르지 않는다. 빈 글만 서버에서 null로 맞춘다.
export const MeetingNotesSchema = z
  .string()
  .refine(value => !nulOrLoneSurrogate.test(value) && codePoints(value) <= MEETING_NOTES_MAX)
  .nullable()
export const AddAgendaSchema = agendaInput
// 빈 사유는 빠진 사유로 받아, 회의 잠금·권한 확인 뒤 REASON_REQUIRED로 알린다.
const amendReason = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  text(MEETING_AMEND_REASON_MAX).optional(),
)
export const UpdateAgendaSchema = z.strictObject({
  title: text(MEETING_AGENDA_TITLE_MAX).optional(),
  body: text(MEETING_AGENDA_BODY_MAX).nullable().optional(),
  notes: MeetingNotesSchema.optional(),
  baseVersionNo,
  reason: amendReason,
})
export const AddDecisionSchema = z.strictObject({
  content: text(MEETING_DECISION_MAX),
  rationale: text(MEETING_DECISION_MAX).nullable().default(null),
})
export const UpdateDecisionSchema = z.strictObject({
  content: text(MEETING_DECISION_MAX).optional(),
  rationale: text(MEETING_DECISION_MAX).nullable().optional(),
  baseVersionNo,
  reason: amendReason,
})
export type AddAgendaRequest = z.infer<typeof AddAgendaSchema>
export type UpdateAgendaRequest = z.infer<typeof UpdateAgendaSchema>
export type AddDecisionRequest = z.infer<typeof AddDecisionSchema>
export type UpdateDecisionRequest = z.infer<typeof UpdateDecisionSchema>
export const UpdateMeetingSchema = z
  .strictObject({
    title: fields.title.optional(),
    heldAt: fields.heldAt.optional(),
    endsAt: fields.endsAt.optional(),
    place: fields.place.optional(),
    purpose: fields.purpose.optional(),
    eventId: fields.eventId.optional(),
    hostDepartmentId: fields.hostDepartmentId.optional(),
    baseVersionNo,
  })
  .refine(input => !input.heldAt || !input.endsAt || input.endsAt > input.heldAt, {
    path: ['endsAt'],
  })
export const ReplaceMeetingAttendeesSchema = z.strictObject({ attendeeIds })
export const CancelMeetingSchema = z.strictObject({ reason: text(MEETING_CANCEL_REASON_MAX) })
export type CreateMeetingRequest = z.infer<typeof CreateMeetingSchema>
export type UpdateMeetingRequest = z.infer<typeof UpdateMeetingSchema>
export type ReplaceMeetingAttendeesRequest = z.infer<typeof ReplaceMeetingAttendeesSchema>
export type CancelMeetingRequest = z.infer<typeof CancelMeetingSchema>

export const MeetingListQuerySchema = z
  .strictObject({
    view: z.enum(['council', 'mine']).default('council'),
    event: recordIdInput.optional(),
    from: koreanDate.optional(),
    to: koreanDate.optional(),
  })
  .refine(input => !input.from || !input.to || input.to >= input.from)
export const MeetingOptionsQuerySchema = z.strictObject({
  event: recordIdInput.optional(),
  hostDepartment: recordIdInput.optional(),
})
export type MeetingListQuery = z.infer<typeof MeetingListQuerySchema>
export type MeetingOptionsQuery = z.infer<typeof MeetingOptionsQuerySchema>

export interface MeetingPerson {
  id: string
  name: string
  current: boolean
}
export interface MeetingSummary {
  id: string
  title: string
  // 한국 시각(YYYY-MM-DDTHH:mm). 새 회의는 끝·장소 필수이나 옛 행의 NULL도 읽는다.
  heldAt: string
  endsAt: string | null
  place: string | null
  event: { id: string; name: string } | null
  hostDepartment: { id: string; name: string } | null
  status: MeetingStatus
  relation: MeetingRelation
  attendeeCount: number
  agendaCount: number
  minutesStatus: MeetingMinutesStatus
  actions: MeetingAction[]
}
export interface MeetingAgendaItem {
  id: string
  position: number
  title: string
  body: string | null
  notes: string | null
  versionNo: number
  updatedBy: MeetingPerson | null
  updatedAt: string
  decisions: MeetingDecision[]
  followUps: MeetingFollowUp[]
}
export interface MeetingFollowUp {
  id: string
  title: string
  status: TaskStatus
  // 한국 날짜(YYYY-MM-DD). 마감 없는 업무는 null이다.
  dueDate: string | null
  assignee: { id: string; name: string } | null
}
export interface MeetingDecision {
  id: string
  content: string
  rationale: string | null
  decidedBy: MeetingPerson | null
  decidedAt: string
  versionNo: number
}
export interface MeetingDetail extends MeetingSummary {
  purpose: string | null
  versionNo: number
  createdBy: MeetingPerson | null
  createdAt: string
  confirmedAt: string | null
  confirmedBy: MeetingPerson | null
  cancelledAt: string | null
  cancelReason: string | null
  attendees: MeetingPerson[]
  agenda: MeetingAgendaItem[]
}
export interface MeetingResponse {
  meeting: MeetingDetail
}
export interface MeetingsResponse {
  meetings: MeetingSummary[]
  truncated: boolean
}
export interface MeetingOptionsResponse {
  departments: { id: string; name: string }[]
  events: { id: string; name: string }[]
  members: MeetingPerson[]
  defaultAttendeeIds: string[]
}
