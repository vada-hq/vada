import { z } from 'zod'
import type { ExpensePerson } from './expenses.js'
import type { FeeAccount } from './fees.js'
import { text, token } from './input.js'
import { koreanDateTime } from './korean-time.js'
import { PURCHASE_INTEGER_MAX } from './purchases.js'

export const REGISTRATION_NAME_MAX = 30
export const REGISTRATION_NOTICE_MAX = 1000
export const REGISTRATION_CAPACITY_MAX = 5000
export const REGISTRATION_FEE_MAX = 1_000_000
// 행사가 끝나고 이만큼 지나면 신청자 정보를 지운다.
export const REGISTRATION_RETENTION_DAYS = 30

const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
// 학번·전화번호에 흔히 넣는 공백과 하이픈을 뺀다. 같은 학번을 다르게 써도 한 사람으로 본다.
const digits = (value: string) => value.replace(/[\s-]/g, '')
export const studentIdInput = token(20).transform(digits).refine(value => /^\d{6,12}$/.test(value))
export const phoneInput = token(20).transform(digits).refine(value => /^01\d{8,9}$/.test(value))

// 참가 신청 설정. 시작은 비울 수 있고, 마감은 꼭 있다. 정원·안내·납부자 참가비도 비울 때 null로 꼭 보낸다.
const fee = z.number().int().min(0).max(REGISTRATION_FEE_MAX)
const fields = {
  opensAt: koreanDateTime.nullable(),
  closesAt: koreanDateTime,
  capacity: z.number().int().min(1).max(REGISTRATION_CAPACITY_MAX).nullable(),
  notice: text(REGISTRATION_NOTICE_MAX).nullable(),
  collectPhone: z.boolean(),
  // 참가비(원). 0원이면 무료다.
  fee,
  // 학생회비 납부자 참가비. 참가비보다 적고, null이면 납부자를 따로 보지 않는다.
  memberFee: fee.nullable(),
}
const ordered = (value: { opensAt: string | null; closesAt: string }) => value.opensAt === null || value.opensAt < value.closesAt
const cheaper = (value: { fee: number; memberFee: number | null }) => value.memberFee === null || value.memberFee < value.fee
export const CreateRegistrationFormSchema = z.strictObject(fields).refine(ordered).refine(cheaper)
export const UpdateRegistrationFormSchema = z.strictObject({ version, accepting: z.boolean(), ...fields }).refine(ordered).refine(cheaper)
// 운영진 취소에는 본문이 없다. 모르는 키를 받지 않도록 빈 객체만 받는다.
export const CancelRegistrationSchema = z.strictObject({})
// 입금 확인과 확인 취소도 본문이 없다.
export const PaymentActionSchema = z.strictObject({})
// 참가비 바꾸기: 이 신청을 학생회비 납부자로 볼지 정한다.
export const SetDuesMemberSchema = z.strictObject({ duesMember: z.boolean() })
export const RegisterSchema = z.strictObject({
  name: text(REGISTRATION_NAME_MAX),
  studentId: studentIdInput,
  // 휴대폰 번호를 받는 신청에서만 넣고, 아니면 null이다. 서버가 설정과 대조한다.
  phone: phoneInput.nullable(),
  agreed: z.literal(true),
})
// 개인 링크 토큰: 무작위 16바이트의 base64url
export const RegistrationTokenSchema = z.strictObject({ token: token(22).refine(value => /^[A-Za-z0-9_-]{22}$/.test(value)) })
// 참석 확인(M3c). 코드는 개인 링크 토큰의 SHA-256(소문자 16진 64자)이고 DB의 token_hash와 같다.
// 해시라서 QR이 새도 내 신청을 보거나 취소할 수 없다(토큰이 있어야 한다).
const checkInCode = /^[0-9a-f]{64}$/
export const CheckInScanSchema = z.strictObject({ code: token(64).refine(value => checkInCode.test(value)) })
// 이름으로 찾아 참석 확인과 확인 취소에는 본문이 없다.
export const CheckInActionSchema = z.strictObject({})
// QR에는 앞에 VADA:를 붙이고 대문자로 담는다. 대문자는 QR 영숫자 모드라 작게 그려진다(버전 4).
export const checkInQrText = (code: string) => `VADA:${code.toUpperCase()}`
// 스캐너가 읽은 글자에서 코드를 꺼낸다. 참가 신청 QR이 아니면 null이다.
export function checkInCodeOf(text: string): string | null {
  const match = /^VADA:([0-9A-F]{64})$/i.exec(text.trim())
  return match ? match[1]!.toLowerCase() : null
}
export type CreateRegistrationFormRequest = z.infer<typeof CreateRegistrationFormSchema>
export type UpdateRegistrationFormRequest = z.infer<typeof UpdateRegistrationFormSchema>
export type RegisterRequest = z.infer<typeof RegisterSchema>
export type SetDuesMemberRequest = z.infer<typeof SetDuesMemberSchema>
export type CheckInScanRequest = z.infer<typeof CheckInScanSchema>

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
  fee: number
  memberFee: number | null
  // 입금을 확인한 신청의 수와 확인 금액 합. 취소했거나 정보를 지운 신청도 센다.
  payments: { count: number; total: number }
  // 참석을 확인한 신청 수. 보관 기간이 지나 정보를 지운 신청도 센다.
  checkedIn: number
}
export interface RegistrationEntry {
  id: string
  name: string
  studentId: string
  phone: string | null
  // 한국 시각
  createdAt: string
  // 신청할 때 정한 학생회비 납부 구분. 납부자 참가비가 없으면 null이다.
  duesMember: boolean | null
  // 낼 돈. 입금을 확인했으면 확인 금액이다.
  fee: number
  // 입금 확인(한국 시각과 확인한 사람). 확인 전이면 null이다.
  paid: { amount: number; at: string; by: ExpensePerson } | null
  // 참석 확인(한국 시각과 확인한 사람). 확인 전이면 null이다.
  checkedIn: { at: string; by: ExpensePerson } | null
}
export interface RegistrationResponse {
  form: RegistrationFormView | null
  // 정보를 지우지 않은 신청만 신청 순서대로
  registrations: RegistrationEntry[]
  // 참가비를 받는 학생회 계좌. 재정 담당자가 정한다.
  account: FeeAccount | null
  // 쓰는 기한이 남은 학생회비 명단. 납부자 목록은 주지 않는다.
  roster: { label: string; useUntil: string } | null
  // 행사 정산이 끝났으면 true다. 입금 확인·확인 취소·참가비 바꾸기·금액 변경을 할 수 없다.
  settled: boolean
}
// QR로 참석 확인한 응답. already는 찍기 전에 이미 참석이었는지다.
export interface CheckInScanResponse extends RegistrationResponse {
  checkIn: { registrationId: string; already: boolean }
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
  fee: number
  memberFee: number | null
}
export interface RegistrationCreated {
  token: string
}
// 참가비를 정한 근거: 납부자 참가비가 없음, 학생회비 납부자, 그 밖
export type PaymentBasis = 'flat' | 'member' | 'nonmember'
export interface MyPayment {
  basis: PaymentBasis
  // 낼 돈. 입금을 확인했으면 확인 금액이다.
  fee: number
  // 입금을 확인한 한국 시각
  paidAt: string | null
  // 낼 돈이 있고 확인 전일 때만 있다.
  account: FeeAccount | null
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
  // 마감 전이고 입금·참석을 확인하지 않았으면 스스로 취소할 수 있다.
  cancellable: boolean
  // 참가비가 없는 신청(참가비 0원이고 납부자 참가비 없음)이나 취소 응답이면 null이다.
  payment: MyPayment | null
  // 참석 확인 QR의 코드. 취소 응답이면 null이다.
  checkInCode: string | null
  // 참석을 확인한 한국 시각
  checkedInAt: string | null
}
