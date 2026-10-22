import { z } from 'zod'
import { EmptyRequestSchema, text } from './input.js'
import { koreanDateTime } from './korean-time.js'
import type { Action } from './permissions.js'
import { recordIdInput } from './team.js'

// 신청 양식(기능 007, DEC-44). 값은 DB CHECK와 같다.
export const REGISTRATION_FORM_NAME_MAX = 50
export const REGISTRATION_NOTICE_MAX = 2000
export const REGISTRATION_CAPACITY_MAX = 5000
export const REGISTRATION_FEE_MAX = 1_000_000
// 한 행사의 양식 목록 상한. 넘치면 truncated다.
export const REGISTRATION_FORM_LIST_LIMIT = 100
// 공개 코드는 초대 코드와 같은 8자다(DB CHECK와 같다).
export const PUBLIC_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/

// 앞에서 맞는 것이 상태다: 마감 → 멈춤 → 시작 전 → 정원 참 → 받는 중. 저장하지 않고 센다.
export const REGISTRATION_STATUSES = ['closed', 'paused', 'before_open', 'full', 'open'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

const fee = z.number().int().min(0).max(REGISTRATION_FEE_MAX)
const capacity = z.number().int().min(1).max(REGISTRATION_CAPACITY_MAX)

// 마감은 필수이고 시작 뒤다. 참가비 두 값은 둘 다 있거나 둘 다 없다. 일시는 한국 시각이라 글자 순서가 시간 순서다.
const hasValidSpan = (input: { opensAt: string | null; closesAt: string }) =>
  input.opensAt === null || input.closesAt > input.opensAt
const hasFeePair = (input: { payerFee: number | null; nonPayerFee: number | null }) =>
  (input.payerFee === null) === (input.nonPayerFee === null)
const isValidForm = (
  input: Parameters<typeof hasValidSpan>[0] & Parameters<typeof hasFeePair>[0],
) => hasValidSpan(input) && hasFeePair(input)

// 양식 만들기와 고치기(관리 권한자). 고치기도 칸을 모두 받아 그대로 바꾼다. 공개 코드는 만들 때 정해 바꾸지 않으므로 받지 않는다.
const fields = {
  name: text(REGISTRATION_FORM_NAME_MAX),
  opensAt: koreanDateTime.nullable(),
  closesAt: koreanDateTime,
  capacity: capacity.nullable(),
  notice: text(REGISTRATION_NOTICE_MAX).nullable(),
  collectsPhone: z.boolean(),
  payerFee: fee.nullable(),
  nonPayerFee: fee.nullable(),
  feeAccountId: recordIdInput.nullable(),
}
export const CreateFormSchema = z
  .strictObject({
    ...fields,
    opensAt: fields.opensAt.default(null),
    capacity: fields.capacity.default(null),
    notice: fields.notice.default(null),
    collectsPhone: fields.collectsPhone.default(false),
    payerFee: fields.payerFee.default(null),
    nonPayerFee: fields.nonPayerFee.default(null),
    feeAccountId: fields.feeAccountId.default(null),
  })
  .refine(isValidForm)
export type CreateFormRequest = z.infer<typeof CreateFormSchema>
export const UpdateFormSchema = z.strictObject(fields).refine(isValidForm)
export type UpdateFormRequest = z.infer<typeof UpdateFormSchema>
// 멈추기와 다시 받기는 본문이 없다.
export const PauseFormSchema = EmptyRequestSchema
export const ResumeFormSchema = EmptyRequestSchema

// 양식마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨긴다(DEC-38).
// 신청자 보기는 관리보다 재정부만큼 넓어서, 둘을 따로 묻는다.
export const REGISTRATION_ACTIONS = [
  'registration.manage',
  'registration.view_applicants',
] as const satisfies readonly Action[]
export type RegistrationAction = (typeof REGISTRATION_ACTIONS)[number]

export interface RegistrationForm {
  id: string
  eventId: string
  name: string
  // 한국 시각 YYYY-MM-DDTHH:mm
  opensAt: string | null
  closesAt: string
  capacity: number | null
  notice: string | null
  collectsPhone: boolean
  paused: boolean
  // 포스터와 QR에 찍히므로 만들 때 정하고 바꾸지 않는다.
  publicCode: string
  payerFee: number | null
  nonPayerFee: number | null
  feeAccount: { id: string; name: string } | null
  status: RegistrationStatus
  // 취소하지 않은 신청 수와 취소하지 않은 출석 수
  applicantCount: number
  attendedCount: number
  // 정원이 없으면 null이고, 정원을 지금 수보다 줄였으면 0이다.
  remaining: number | null
  // 신청자 정보를 지우는 날(한국 날짜 YYYY-MM-DD)
  purgeOn: string
  actions: RegistrationAction[]
}

export interface RegistrationFormsResponse {
  forms: RegistrationForm[]
  truncated: boolean
}
export interface RegistrationFormResponse {
  form: RegistrationForm
}

// 로그인 없이 읽는 양식. 계좌, 신청자, 운영진, 내부 번호는 담지 않는다.
export interface PublicRegistrationForm {
  councilName: string
  event: { name: string; startsAt: string | null; endsAt: string | null; place: string | null }
  form: { name: string; opensAt: string | null; closesAt: string; notice: string | null }
  status: RegistrationStatus
  remaining: number | null
  payerFee: number | null
  nonPayerFee: number | null
  // 두 참가비가 다를 때만 학번을 받는다(DEC-62).
  collectsStudentId: boolean
  collectsPhone: boolean
  purgeOn: string
}
