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
