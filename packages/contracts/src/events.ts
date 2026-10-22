import { z } from 'zod'
import { text } from './input.js'
import { koreanDateTime } from './korean-time.js'
import type { Action } from './permissions.js'
import { recordIdInput } from './team.js'

// 행사(DEC-28). 값은 DB CHECK와 같다.
export const EVENT_NAME_MAX = 100
export const EVENT_PLACE_MAX = 100
// 목록 상한. 넘치면 truncated다.
export const EVENT_LIST_LIMIT = 200

// 상태는 저장하지 않고 센다(서버가 센다). 마지막 결재가 완료이면 completed, 아니면 시각으로 센다.
export const EVENT_STATUSES = ['tbd', 'upcoming', 'ongoing', 'ended', 'completed'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

// 끝만 있는 행사는 없고, 끝은 시작 뒤다. 일시는 한국 시각 YYYY-MM-DDTHH:mm이라 글자 순서가 시간 순서다.
const hasValidSpan = (input: { startsAt: string | null; endsAt: string | null }) =>
  input.endsAt === null || (input.startsAt !== null && input.endsAt > input.startsAt)

// 행사 만들기(회장단). 책임자는 비울 수 있다.
export const CreateEventSchema = z
  .strictObject({
    name: text(EVENT_NAME_MAX),
    startsAt: koreanDateTime.nullable().default(null),
    endsAt: koreanDateTime.nullable().default(null),
    place: text(EVENT_PLACE_MAX).nullable().default(null),
    ownerId: recordIdInput.nullable().default(null),
  })
  .refine(hasValidSpan)
export type CreateEventRequest = z.infer<typeof CreateEventSchema>
// 이름, 일시, 장소 고치기(책임자). 칸을 모두 받아 그대로 바꾼다(비운 칸은 null).
export const UpdateEventSchema = z
  .strictObject({
    name: text(EVENT_NAME_MAX),
    startsAt: koreanDateTime.nullable(),
    endsAt: koreanDateTime.nullable(),
    place: text(EVENT_PLACE_MAX).nullable(),
  })
  .refine(hasValidSpan)
export type UpdateEventRequest = z.infer<typeof UpdateEventSchema>
// 책임자 바꾸기와 비우기(회장단). 비우려면 null을 보낸다(키를 빼면 400).
export const SetEventOwnerSchema = z.strictObject({ ownerId: recordIdInput.nullable() })
export type SetEventOwnerRequest = z.infer<typeof SetEventOwnerSchema>

// 행사마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨긴다(DEC-38).
export const EVENT_ACTIONS = [
  'event.update',
  'event.set_owner',
] as const satisfies readonly Action[]
export type EventAction = (typeof EVENT_ACTIONS)[number]

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

export interface EventDetail extends EventSummary {
  // 지우지 않은 이 행사의 업무 수
  tasks: { open: number; total: number }
  // 오래된 판부터 모두
  history: EventVersion[]
  actions: EventAction[]
}

export interface EventsResponse {
  events: EventSummary[]
  truncated: boolean
}
export interface EventResponse {
  event: EventDetail
}
