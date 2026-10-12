import { z } from 'zod'
import { text, token } from './input.js'
import { koreanDateTime } from './korean-time.js'
import { PURCHASE_INTEGER_MAX } from './purchases.js'

export const EVENT_NAME_MAX = 100
export const EVENT_PLACE_MAX = 100
export const CreateEventSchema = z.strictObject({ name: text(EVENT_NAME_MAX) })
export type CreateEventRequest = z.infer<typeof CreateEventSchema>
const id = token(64)
// 행사 정보 수정. 끝은 시작이 있어야 하고 시작보다 늦다. 비울 때도 null로 꼭 보낸다.
// 담당 부서·책임자(M5b)는 같은 학생회 부서, 부서가 있는 구성원(memberships.id)만 받는다. 서버가 책임자를 사용자로 바꿔 저장한다.
export const UpdateEventSchema = z.strictObject({
  version: z.number().int().min(1).max(PURCHASE_INTEGER_MAX),
  startsAt: koreanDateTime.nullable(),
  endsAt: koreanDateTime.nullable(),
  place: text(EVENT_PLACE_MAX).nullable(),
  ownerDepartmentId: id.nullable(),
  ownerMembershipId: id.nullable(),
}).refine(value => value.endsAt === null || (value.startsAt !== null && value.endsAt > value.startsAt))
export type UpdateEventRequest = z.infer<typeof UpdateEventSchema>
// 행사 완료·완료 취소(M5a). 화면이 본 행사 버전을 보낸다.
export const CompleteEventSchema = z.strictObject({ version: z.number().int().min(1).max(PURCHASE_INTEGER_MAX) })
export const CancelEventCompletionSchema = CompleteEventSchema
export type CompleteEventRequest = z.infer<typeof CompleteEventSchema>

// 행사 단계(M5a). 저장하지 않고 날짜로 계산한다. now와 행사 일시는 한국 시각 "YYYY-MM-DDTHH:mm"이라 글자로 비교한다.
// 끝 일시가 없으면 시작한 날(한국 날짜)이 끝날 때까지 진행 중이다. 화면의 단계 칩과 운영 현황(M6) 서버가 같이 쓴다.
export type EventPhase = 'planning' | 'ongoing' | 'wrapping' | 'completed'
export function eventPhaseOf(event: { startsAt: string | null; endsAt: string | null; completedAt: string | null }, now: string): EventPhase {
  if (event.completedAt) return 'completed'
  if (!event.startsAt || now < event.startsAt) return 'planning'
  if (event.endsAt) return now < event.endsAt ? 'ongoing' : 'wrapping'
  return now.slice(0, 10) === event.startsAt.slice(0, 10) ? 'ongoing' : 'wrapping'
}
