import { z } from 'zod'
import { EmptyRequestSchema, text, token } from './input.js'
import type { ApplicantDeposit } from './deposits.js'
import { koreanDateTime } from './korean-time.js'
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
// 두 참가비가 다르면 학번을 꼭 받는다. 적용 참가비를 납부자 명단과 학번으로 정하기 때문이다(DEC-75, DB CHECK와 같다).
type FeePair = { payerFee: number | null; nonPayerFee: number | null }
const hasValidSpan = (input: { opensAt: string | null; closesAt: string }) =>
  input.opensAt === null || input.closesAt > input.opensAt
const hasFeePair = (input: FeePair) => (input.payerFee === null) === (input.nonPayerFee === null)
const collectsNeededStudentId = (input: FeePair & { collectsStudentId: boolean }) =>
  input.collectsStudentId || input.payerFee === input.nonPayerFee
const isValidForm = (
  input: Parameters<typeof hasValidSpan>[0] & Parameters<typeof collectsNeededStudentId>[0],
) => hasValidSpan(input) && hasFeePair(input) && collectsNeededStudentId(input)

// 양식 만들기와 고치기(관리 권한자). 고치기도 칸을 모두 받아 그대로 바꾼다. 공개 코드는 만들 때 정해 바꾸지 않으므로 받지 않는다.
const fields = {
  name: text(REGISTRATION_FORM_NAME_MAX),
  opensAt: koreanDateTime.nullable(),
  closesAt: koreanDateTime,
  capacity: capacity.nullable(),
  notice: text(REGISTRATION_NOTICE_MAX).nullable(),
  collectsPhone: z.boolean(),
  collectsStudentId: z.boolean(),
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
    // 새 양식은 학번을 받는다(DEC-75). 같은 이름의 신청자를 가리고 입금을 대조하는 데 쓴다.
    collectsStudentId: fields.collectsStudentId.default(true),
    payerFee: fields.payerFee.default(null),
    nonPayerFee: fields.nonPayerFee.default(null),
    feeAccountId: fields.feeAccountId.default(null),
    // 이 양식을 이을 업무(기능 015). 이 학생회의 끝나지 않은 업무로 내가 상태를 바꿀 수 있는 것만 된다. 비우거나 빼면 잇지 않는다.
    taskId: recordIdInput.nullish(),
  })
  .refine(isValidForm)
export type CreateFormRequest = z.infer<typeof CreateFormSchema>
export const UpdateFormSchema = z.strictObject(fields).refine(isValidForm)
export type UpdateFormRequest = z.infer<typeof UpdateFormSchema>
// 멈추기와 다시 받기는 본문이 없다.
export const PauseFormSchema = EmptyRequestSchema
export const ResumeFormSchema = EmptyRequestSchema

// 양식마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨긴다(DEC-38).
// 화면이 누르는 일 하나에 이름 하나다. 권한 키(Action)와 따로이고, 서버 정책(registrations/policy.ts)이 동작을 권한 키와 상태 조건으로 잇는다.
// 신청자 보기는 관리보다 재정부만큼 넓어서 따로 묻는다. 신청자 보기만 완료한 행사에서도 남는다(RULE-11은 쓰기만 잠근다).
export const FORM_ACTIONS = [
  'form.update',
  'form.pause',
  'form.resume',
  'form.check_in',
  'form.view_applicants',
] as const
export type FormAction = (typeof FORM_ACTIONS)[number]
// 양식 목록(행사 하나)의 동작. 양식이 없어도 [신청 양식 만들기]를 보일지 가른다.
export const FORM_LIST_ACTIONS = ['form.create'] as const
export type FormListAction = (typeof FORM_LIST_ACTIONS)[number]

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
  collectsStudentId: boolean
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
  actions: FormAction[]
}

export interface RegistrationFormsResponse {
  forms: RegistrationForm[]
  truncated: boolean
  // 이 행사에서 지금 사람이 할 수 있는 동작. 양식이 없어도 [신청 양식 만들기]를 보일지 가른다.
  actions: FormListAction[]
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
  // 양식의 학번 받기(DEC-75). 두 참가비가 다르면 늘 true다.
  collectsStudentId: boolean
  collectsPhone: boolean
  purgeOn: string
}

// 신청(기능 007 조각 3). 학번과 휴대폰은 양식이 받을 때만 받는다(DEC-75). 받는 칸인지는 서버가 양식으로 본다(409 FORM_CHANGED).
export const STUDENT_ID_PATTERN = /^[0-9]{6,12}$/
export const PHONE_PATTERN = /^01[0-9]{8,9}$/
// 휴대폰은 공백과 '-'가 섞여 와도 받는다(010-1234-5678). 줄이기 전 글자 수의 상한이다.
const PHONE_INPUT_MAX = 20
const STUDENT_ID_INPUT_MAX = 12

const phone = token(PHONE_INPUT_MAX)
  .transform(value => value.replace(/[\s-]/g, ''))
  .refine(value => PHONE_PATTERN.test(value))
export const ApplySchema = z.strictObject({
  name: text(REGISTRATION_FORM_NAME_MAX),
  studentId: token(STUDENT_ID_INPUT_MAX)
    .refine(value => STUDENT_ID_PATTERN.test(value))
    .nullable()
    .default(null),
  phone: phone.nullable().default(null),
})
export type ApplyRequest = z.infer<typeof ApplySchema>

// 개인 링크 토큰(주소의 # 뒤). 128비트를 base64url로 쓰면 22자다. 모르는 토큰은 형식과 상관없이 404라서 길이만 막는다.
const REGISTRATION_TOKEN_MAX = 64
export const TokenSchema = z.strictObject({ token: token(REGISTRATION_TOKEN_MAX) })
export type TokenRequest = z.infer<typeof TokenSchema>

export interface ApplyResponse {
  // 한 번만 준다. DB에는 해시만 있어 다시 볼 수 없다.
  token: string
}
export interface CancelRegistrationResponse {
  cancelled: true
}

// 개인 링크로 보는 내 신청. 내가 넣은 것과 적용 참가비, 참가비가 0보다 크면 계좌, 출석 QR 글자를 담는다.
export interface MyRegistration {
  councilName: string
  event: PublicRegistrationForm['event']
  form: PublicRegistrationForm['form']
  mine: { name: string; studentId: string | null; phone: string | null }
  appliedFee: number
  account: { bank: string; accountNumber: string; holder: string } | null
  qrText: string
  attended: boolean
  // 마감 전이고 출석 전이면 스스로 취소할 수 있다(멈춤이어도).
  cancellable: boolean
  purgeOn: string
}

// 출석 QR 글자는 'VADA:'와 토큰 SHA-256(대문자 16진)이다. 저장은 소문자 16진 64자(DB CHECK)라 찾을 때 맞춘다.
const QR_PREFIX = 'VADA:'
const HASH_HEX = /^[0-9a-f]{64}$/i
export const qrTextOf = (tokenHash: string) => `${QR_PREFIX}${tokenHash.toUpperCase()}`
// QR 글자에서 해시를 꺼낸다(소문자). VADA 글자가 아니거나 해시 모양이 아니면 null이다.
export function tokenHashOfQr(value: string): string | null {
  if (!value.startsWith(QR_PREFIX)) return null
  const hash = value.slice(QR_PREFIX.length)
  return HASH_HEX.test(hash) ? hash.toLowerCase() : null
}

// 신청자 목록(조각 4). 열람 권한자만 받고, 받을 때마다 열람 기록이 한 줄 남는다.
// 한 양식의 신청은 정원(5,000)을 넘기지 않지만 정원이 없는 양식이 있어 상한을 둔다. 넘치면 truncated다.
export const APPLICANT_LIST_LIMIT = 5000
// 신청자 한 줄마다 서버가 주는 할 수 있는 동작(DEC-38). 화면은 이것만 보고 버튼을 보인다.
// 출석한 신청은 신청 취소 대신 출석 취소만 준다. 완료한 행사의 줄은 비어 있다(RULE-11).
export const APPLICANT_ACTIONS = [
  'registration.check_in',
  'registration.cancel_check_in',
  'registration.cancel',
  'deposit.confirm',
  'deposit.cancel',
  'deposit.refund',
] as const
export type ApplicantAction = (typeof APPLICANT_ACTIONS)[number]

// 신청자 줄을 바꾸는 쓰기(출석, 출석 취소, 신청 취소, 입금 확인, 확인 취소, 환불함)가 돌려주는 그 줄의 새 모습.
// 바뀔 수 있는 상태 칸과, 서버가 같은 거래에서 목록과 같은 판정으로 센 새 actions만 담는다. 신청자 정보(이름, 학번, 휴대폰 번호)는 담지 않아 열람 기록이 필요 없다.
// deposit.amount(사람마다의 입금액, DEC-70)는 담지만, 이 쓰기를 하는 역할(registration.manage, deposit.confirm, finance.manage)이 모두 registration.view_applicants에 포함되어 새로 보이는 사람이 없다.
export interface ApplicantChange {
  id: string
  attended: boolean
  cancelled: boolean
  deposit: ApplicantDeposit
  // 그 줄이 신청자 목록에 남는가. 환불함이나 입금 없는 취소는 목록에서 빠진다. 서버가 목록 조회와 같은 규칙으로 센다.
  listed: boolean
  actions: ApplicantAction[]
}
export interface ApplicantChangeResponse {
  applicant: ApplicantChange
}
// 운영진의 출석 취소와 신청 취소 응답
export type StaffCancelResponse = CancelRegistrationResponse & ApplicantChangeResponse

export interface Applicant {
  id: string
  name: string
  // 학번은 학번을 받는 양식에서만 있다(DEC-75). 받기를 끄기 전에 받은 학번은 남는다.
  studentId: string | null
  phone: string | null
  appliedFee: number
  // 두 참가비가 같으면 구분이 없어 null이다.
  payer: boolean | null
  // 같은 행사(양식 여럿 포함)에 취소하지 않은 같은 학번이 둘 이상이다(DEC-26: 막지 않고 드러낸다).
  duplicateStudentId: boolean
  attended: boolean
  appliedAt: string
  // 취소했지만 입금이 남아 환불을 기다리는 신청이면 true다(이름·휴대폰 번호가 남고 학번은 비었다).
  cancelled: boolean
  deposit: ApplicantDeposit
  actions: ApplicantAction[]
}
export interface ApplicantsResponse {
  applicants: Applicant[]
  truncated: boolean
}

// 출석 확인은 QR 글자에서 꺼낸 해시(tokenHashOfQr)로 한다. 글자 전체가 아니라 해시만 보내 'VADA:' 모양을 서버가 따로 알 필요가 없다.
const TOKEN_HASH_LENGTH = 64
export const CheckInSchema = z.strictObject({
  tokenHash: token(TOKEN_HASH_LENGTH).refine(value => HASH_HEX.test(value)),
})
export type CheckInRequest = z.infer<typeof CheckInSchema>
// 출석 확인 결과. 스캔한 사람에게 이름과 학번을 크게 보여 준다. 이미 출석이면 오류가 아니라 already다.
export interface CheckInResult {
  registrationId: string
  name: string
  studentId: string | null
  already: boolean
  // 그 줄의 새 모습(이름·학번은 위에 이미 있고 열람 기록이 남는다)
  applicant: ApplicantChange
}
