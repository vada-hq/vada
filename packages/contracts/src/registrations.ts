import { z } from 'zod'
import { text, token } from './input.js'
import { koreanDateTime } from './korean-time.js'
import { PURCHASE_INTEGER_MAX } from './purchases.js'

export const REGISTRATION_NAME_MAX = 30
export const REGISTRATION_NOTICE_MAX = 1000
export const REGISTRATION_CAPACITY_MAX = 5000
// 행사가 끝나고 이만큼 지나면 신청자 정보를 지운다.
export const REGISTRATION_RETENTION_DAYS = 30

const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
// 학번·전화번호에 흔히 넣는 공백과 하이픈을 뺀다. 같은 학번을 다르게 써도 한 사람으로 본다.
const digits = (value: string) => value.replace(/[\s-]/g, '')
export const studentIdInput = token(20).transform(digits).refine(value => /^\d{6,12}$/.test(value))
export const phoneInput = token(20).transform(digits).refine(value => /^01\d{8,9}$/.test(value))

// 참가 신청 설정. 시작은 비울 수 있고, 마감은 꼭 있다. 정원·안내도 비울 때 null로 꼭 보낸다.
const fields = {
  opensAt: koreanDateTime.nullable(),
  closesAt: koreanDateTime,
  capacity: z.number().int().min(1).max(REGISTRATION_CAPACITY_MAX).nullable(),
  notice: text(REGISTRATION_NOTICE_MAX).nullable(),
  collectPhone: z.boolean(),
}
const ordered = (value: { opensAt: string | null; closesAt: string }) => value.opensAt === null || value.opensAt < value.closesAt
export const CreateRegistrationFormSchema = z.strictObject(fields).refine(ordered)
export const UpdateRegistrationFormSchema = z.strictObject({ version, accepting: z.boolean(), ...fields }).refine(ordered)
// 운영진 취소에는 본문이 없다. 모르는 키를 받지 않도록 빈 객체만 받는다.
export const CancelRegistrationSchema = z.strictObject({})
export const RegisterSchema = z.strictObject({
  name: text(REGISTRATION_NAME_MAX),
  studentId: studentIdInput,
  // 휴대폰 번호를 받는 신청에서만 넣고, 아니면 null이다. 서버가 설정과 대조한다.
  phone: phoneInput.nullable(),
  agreed: z.literal(true),
})
// 개인 링크 토큰: 무작위 16바이트의 base64url
export const RegistrationTokenSchema = z.strictObject({ token: token(22).refine(value => /^[A-Za-z0-9_-]{22}$/.test(value)) })
export type CreateRegistrationFormRequest = z.infer<typeof CreateRegistrationFormSchema>
export type UpdateRegistrationFormRequest = z.infer<typeof UpdateRegistrationFormSchema>
export type RegisterRequest = z.infer<typeof RegisterSchema>

// 위에서부터 먼저 맞는 것이다: 마감 → 멈춤 → 시작 전 → 정원 참 → 받는 중
export type RegistrationState = 'open' | 'paused' | 'upcoming' | 'full' | 'closed'
export interface RegistrationFormView {
  id: string
  // 공개 링크 /apply/{code}의 코드. 바뀌지 않는다.
  code: string
  accepting: boolean
  opensAt: string | null
  closesAt: string
  capacity: number | null
  notice: string | null
  collectPhone: boolean
  version: number
  state: RegistrationState
  // 취소하지 않은 신청 수. 보관 기간이 지나 정보를 지운 신청도 센다.
  count: number
  // 신청자 정보를 지우는 날(한국 날짜)
  purgeAfter: string
  // 지울 때가 지나 신청자 정보를 지웠는지
  purged: boolean
  updatedAt: string
}
export interface RegistrationEntry {
  id: string
  name: string
  studentId: string
  phone: string | null
  // 한국 시각
  createdAt: string
}
export interface RegistrationResponse {
  form: RegistrationFormView | null
  // 정보를 지우지 않은 신청만 신청 순서대로
  registrations: RegistrationEntry[]
}
export interface PublicRegistrationEvent {
  name: string
  startsAt: string | null
  endsAt: string | null
  place: string | null
}
// 공개 신청 화면이 받는 것. 다른 신청자에 대해서는 남은 자리 수만 있다.
export interface PublicRegistrationForm {
  organizationName: string
  event: PublicRegistrationEvent
  notice: string | null
  collectPhone: boolean
  state: RegistrationState
  opensAt: string | null
  closesAt: string
  // 정원이 없으면 null이다.
  remaining: number | null
  purgeAfter: string
}
export interface RegistrationCreated {
  token: string
}
export interface MyRegistration {
  code: string
  organizationName: string
  event: PublicRegistrationEvent
  // 취소 응답에서는 비운다.
  name: string | null
  studentId: string | null
  phone: string | null
  createdAt: string
  // 신청 마감(한국 시각). 이때까지 스스로 취소할 수 있다.
  closesAt: string
  cancelled: boolean
  // 마감 전이면 스스로 취소할 수 있다.
  cancellable: boolean
}
