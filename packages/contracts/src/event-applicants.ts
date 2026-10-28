import { z } from 'zod'
import type { ErrorCode } from './errors.js'
import { DEPOSIT_STATUSES } from './deposits.js'
import { text, token } from './input.js'
import type { Applicant } from './registrations.js'
import { recordIdInput } from './team.js'

export const EVENT_APPLICANT_PAGE_SIZE = 50
const PAGE_MAX = 100_000
const ACCESS_TOKEN_MAX = 512
const SEARCH_MAX = 50
export const EventApplicantsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(PAGE_MAX).default(1),
  registration: z.enum(['active', 'cancelled']).optional(),
  deposit: z.enum(DEPOSIT_STATUSES).optional(),
  attendance: z.enum(['attended', 'not_attended']).optional(),
  needsAttention: z
    .enum(['true', 'false'])
    .transform(value => value === 'true')
    .optional(),
  search: text(SEARCH_MAX).optional(),
  accessToken: token(ACCESS_TOKEN_MAX).optional(),
})
export type EventApplicantsQuery = z.infer<typeof EventApplicantsQuerySchema>

export interface EventApplicant extends Applicant {
  formId: string
  formTitle: string
  // 학적 질문이 있는 양식의 답만 담는다. 아직 그 질문을 받지 않는 양식은 null이다.
  affiliation: string | null
  needsAttention: boolean
}
export interface EventApplicantsResponse {
  applicants: EventApplicant[]
  counts: { applicants: number; attended: number }
  total: number
  page: number
  canView: boolean
  canManage: boolean
  showAffiliation: boolean
  showForm: boolean
  accessToken: string | null
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
