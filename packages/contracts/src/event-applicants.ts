import { z } from 'zod'
import type { ErrorCode } from './errors.js'
import type { ShownAnswer } from './registration-questions.js'
import type { Applicant } from './registrations.js'
import { recordIdInput } from './team.js'

// 화면이 한 쪽에 보이는 줄 수이자 일괄 처리 한 번의 상한이다. 명단은 한 번에 읽고(상한 APPLICANT_LIST_LIMIT) 화면이 쪽을 넘긴다.
// 서버에서 쪽을 넘기면 쪽마다 열람 기록이 늘어서다(DEC-93, DEC-65).
export const EVENT_APPLICANT_PAGE_SIZE = 50
// 거르기·찾기·쪽 넘김은 화면이 한다. 질의 값은 받지 않는다(모르는 키는 400).
export const EventApplicantsQuerySchema = z.strictObject({})

export interface EventApplicant extends Applicant {
  formId: string
  formTitle: string
  // 학적 질문이 있는 양식의 답만 담는다. 아직 그 질문을 받지 않는 양식은 null이다.
  affiliation: string | null
  // 그 신청 양식의 질문마다 답 하나(신청자 정보라 이름과 같은 열람 기록 아래에서만 준다)
  answers: ShownAnswer[]
  needsAttention: boolean
}
export interface EventApplicantsResponse {
  applicants: EventApplicant[]
  counts: { applicants: number; attended: number }
  // 명단이 상한(APPLICANT_LIST_LIMIT)을 넘어 잘렸다.
  truncated: boolean
  canView: boolean
  canManage: boolean
  showAffiliation: boolean
  showForm: boolean
}

export const BulkApplicantsSchema = z.strictObject({
  registrationIds: z
    .array(recordIdInput)
    .min(1)
    .max(EVENT_APPLICANT_PAGE_SIZE)
    .refine(ids => new Set(ids.map(id => id.toLowerCase())).size === ids.length),
})
export type BulkApplicantsRequest = z.infer<typeof BulkApplicantsSchema>
export interface BulkApplicantsResponse {
  results: { registrationId: string; error: ErrorCode | 'REQUEST_FAILED' | null }[]
}
