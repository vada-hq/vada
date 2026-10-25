import { z } from 'zod'
import { text } from './input.js'
import { koreanDateTime } from './korean-time.js'
import type { ErrorCode } from './errors.js'
import type { SettlementApproval } from './settlement.js'
import { PURCHASE_REASON_MAX } from './purchases.js'
import { recordIdInput } from './team.js'

// 행사(DEC-28). 값은 DB CHECK와 같다.
export const EVENT_NAME_MAX = 100
export const EVENT_PLACE_MAX = 100
// 목록 상한. 넘치면 truncated다.
export const EVENT_LIST_LIMIT = 200

// 상태는 저장하지 않고 센다(서버가 센다). 마지막 결재가 완료이면 completed, 아니면 시각으로 센다. 화면 이름은 labels.ts에 있다.
export const EVENT_STATUSES = ['tbd', 'upcoming', 'ongoing', 'ended', 'completed'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]
// 끝난 지 이 날수부터 행사 머리에 '끝난 지 N일'을 보인다(DEC-93). 완료를 잊은 행사 알림도 같은 날수를 쓴다.
export const EVENT_ENDED_NOTICE_DAYS = 7

// 끝만 있는 행사는 없고, 끝은 시작 뒤다. 일시는 한국 시각 YYYY-MM-DDTHH:mm이라 글자 순서가 시간 순서다.
const hasValidSpan = (input: { startsAt: string | null; endsAt: string | null }) =>
  input.endsAt === null || (input.startsAt !== null && input.endsAt > input.startsAt)

// 행사 만들기(회장단과 부서장, DEC-93). 책임자는 받지 않는다: 서버가 만든 사람으로 채운다(DEC-79). 보내면 모르는 키라 400이다.
export const CreateEventSchema = z
  .strictObject({
    name: text(EVENT_NAME_MAX),
    startsAt: koreanDateTime.nullable().default(null),
    endsAt: koreanDateTime.nullable().default(null),
    place: text(EVENT_PLACE_MAX).nullable().default(null),
    // 이 행사를 이을 업무(기능 015). 업무 자신의 행사는 바뀌지 않는다. 비우거나 빼면 잇지 않는다.
    taskId: recordIdInput.nullish(),
  })
  .refine(hasValidSpan)
export type CreateEventRequest = z.infer<typeof CreateEventSchema>
// 이름, 일시, 장소 고치기(회장단과 책임자, DEC-79). 칸을 모두 받아 그대로 바꾼다(비운 칸은 null).
export const UpdateEventSchema = z
  .strictObject({
    name: text(EVENT_NAME_MAX),
    startsAt: koreanDateTime.nullable(),
    endsAt: koreanDateTime.nullable(),
    place: text(EVENT_PLACE_MAX).nullable(),
  })
  .refine(hasValidSpan)
export type UpdateEventRequest = z.infer<typeof UpdateEventSchema>

// 완료(회장단). 사유는 적을 수만 있다(결재 기록에 남는다).
export const CompleteEventSchema = z.strictObject({
  reason: text(PURCHASE_REASON_MAX).nullable().default(null),
})
export type CompleteEventRequest = z.infer<typeof CompleteEventSchema>
// 완료 취소(회장단). 사유가 꼭 있다. 참가비 수입을 취소할 때도 같은 사유를 쓴다.
export const CancelCompletionSchema = z.strictObject({ reason: text(PURCHASE_REASON_MAX) })
export type CancelCompletionRequest = z.infer<typeof CancelCompletionSchema>

// 행사마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨긴다(DEC-38).
// 화면이 누르는 일 하나에 이름 하나다. 권한 키(Action)와 따로이고, 서버 정책(events/policy.ts)이 동작을 권한 키와 상태 조건으로 잇는다.
export const EVENT_ACTIONS = ['event.update', 'event.complete', 'event.cancel_completion'] as const
export type EventAction = (typeof EVENT_ACTIONS)[number]
// 역할은 있는데 상태가 막은 완료·완료 취소와 그 쓰기가 내는 오류 코드(회장단에게만). 풀릴 수 있는 막힘만 있다(끝나기 전, 정산 남음, 기간 없음, 기간 공개).
export type EventBlockers = Partial<Record<'event.complete' | 'event.cancel_completion', ErrorCode>>

export interface EventSummary {
  id: string
  name: string
  // 한국 시각 YYYY-MM-DDTHH:mm. 정하지 않았으면 null이다.
  startsAt: string | null
  endsAt: string | null
  place: string | null
  // current가 false이면 떠난 사람이다.
  owner: { id: string; name: string; current: boolean } | null
  status: EventStatus
}

type EventPerson = { id: string; name: string | null } | null
// 판 사이에 바뀐 칸 하나. 책임자는 지금 이름이다(name이 null이면 이름을 모르는 사람).
export type EventChange =
  | { field: 'created' }
  | { field: 'name'; from: string; to: string }
  | { field: 'startsAt' | 'endsAt' | 'place'; from: string | null; to: string | null }
  | { field: 'owner'; from: EventPerson; to: EventPerson }

export interface EventVersion {
  versionNo: number
  // 이 판이 열린 시각(ISO)
  at: string
  by: { id: string; name: string } | null
  changes: EventChange[]
}

// 행사 머리의 다음 일정: 지금 뒤의 가장 이른 것. 업무는 마감 날짜(한국), 행사 시작은 한국 시각 YYYY-MM-DDTHH:mm이다.
type EventNext =
  { kind: 'task'; dueDate: string; title: string } | { kind: 'start'; startsAt: string }

export interface EventDetail extends EventSummary {
  // 지우지 않은 이 행사의 업무 수
  tasks: { open: number; total: number }
  // 담당 부서 이름: 이 행사에 이은 취소·끝나지 않은 업무를 맡은 부서, 중복 없이 이름순(DEC-25, DEC-93). 없으면 빈 목록이다.
  departments: string[]
  // 건강도의 근거(DEC-93): 끝나지 않은 업무 가운데 마감이 지난 것과 담당자 없는 것(업무 화면의 '담당자 없음')의 수. 둘 다 0이면 안정이다.
  health: { overdue: number; unassigned: number }
  // 없으면 null이다.
  next: EventNext | null
  // 끝난 지 며칠(한국 날짜로 센다). 끝났고 완료하지 않은 행사만 수이고, 나머지는 null이다.
  endedDays: number | null
  // 오래된 판부터 모두
  history: EventVersion[]
  // 완료와 완료 취소 결재를 오래된 것부터 모두(DEC-68)
  approvals: SettlementApproval[]
  actions: EventAction[]
  blockers: EventBlockers
}

export interface EventsResponse {
  events: EventSummary[]
  truncated: boolean
}
export interface EventResponse {
  event: EventDetail
}
