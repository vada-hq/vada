import { z } from 'zod'
import { commandIdInput, EmptyRequestSchema, text, token } from './input.js'
import type { ApplicantDeposit } from './deposits.js'
import { koreanDateTime } from './korean-time.js'
import { recordIdInput } from './team.js'
import {
  AnswersSchema,
  QuestionsInputSchema,
  type FormQuestion,
  type ShownAnswer,
} from './registration-questions.js'
export * from './event-applicants.js'
export * from './registration-questions.js'

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

const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  closed: '종료',
  paused: '잠시 멈춤',
  before_open: '시작 전',
  full: '정원 마감',
  open: '활성',
}
export const registrationStatusLabel = (status: RegistrationStatus, applicantCount: number) =>
  status === 'paused' && applicantCount === 0 ? '초안' : REGISTRATION_STATUS_LABELS[status]

export const FORM_ACTIVATION_CONDITIONS = [
  'event_starts_at',
  'closes_at',
  'registration_period',
  'fee_account',
] as const
export type FormActivationCondition = (typeof FORM_ACTIVATION_CONDITIONS)[number]
type ActivationFacts = {
  eventStartsAt: string | null
  opensAt: string | null
  closesAt: string | null
  payerFee: number | null
  nonPayerFee: number | null
  feeAccountId: string | null
}
// 마감은 신청 시작보다 뒤여야 한다. 신청 시작이 비면 즉시 받는다(DEC-44).
export function missingFormConditions(facts: ActivationFacts): FormActivationCondition[] {
  const missing: FormActivationCondition[] = []
  if (!facts.eventStartsAt) missing.push('event_starts_at')
  if (!facts.closesAt) missing.push('closes_at')
  if (facts.opensAt && facts.closesAt && facts.closesAt <= facts.opensAt)
    missing.push('registration_period')
  if (Math.max(facts.payerFee ?? 0, facts.nonPayerFee ?? 0) > 0 && !facts.feeAccountId)
    missing.push('fee_account')
  return missing
}
export const ActivateFormSchema = EmptyRequestSchema
export type ActivateFormRequest = z.infer<typeof ActivateFormSchema>
export type ActivateFormResponse = RegistrationFormResponse
export const FormActivationFailureSchema = z.strictObject({
  error: z.literal('FORM_NOT_READY'),
  missingConditions: z
    .array(z.enum(FORM_ACTIVATION_CONDITIONS))
    .max(FORM_ACTIVATION_CONDITIONS.length),
})
export type FormActivationFailure = z.infer<typeof FormActivationFailureSchema>

const fee = z.number().int().min(0).max(REGISTRATION_FEE_MAX)
const capacity = z.number().int().min(1).max(REGISTRATION_CAPACITY_MAX)

// 마감은 시작 뒤다. 초안은 마감을 비울 수 있고(행사 시작이 미정일 때, DEC-93) 활성화가 마감 없음을 막는다. 참가비 두 값은 둘 다 있거나 둘 다 없다. 일시는 한국 시각이라 글자 순서가 시간 순서다.
// 두 참가비가 다르면 학번을 꼭 받는다. 적용 참가비를 납부자 명단과 학번으로 정하기 때문이다(DEC-75, DB CHECK와 같다).
type FeePair = { payerFee: number | null; nonPayerFee: number | null }
const hasValidSpan = (input: { opensAt: string | null; closesAt: string | null }) =>
  input.opensAt === null || input.closesAt === null || input.closesAt > input.opensAt
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
  // 칸은 늘 보낸다. 비우기(null)는 신청이 없는 멈춘 양식(초안)만 된다(409 CLOSES_AT_REQUIRED).
  closesAt: koreanDateTime.nullable(),
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
    questions: QuestionsInputSchema.default([]),
    // 이 양식을 이을 업무(기능 015). 이 학생회의 끝나지 않은 업무로 내가 상태를 바꿀 수 있는 것만 된다. 비우거나 빼면 잇지 않는다.
    taskId: recordIdInput.nullish(),
  })
  .refine(isValidForm)
export type CreateFormRequest = z.infer<typeof CreateFormSchema>
// 질문은 목록 전체를 받아 그대로 바꾼다. 빼면 질문을 그대로 둔다. 신청이 있는 양식은 같은 목록만 받는다(409 FORM_HAS_APPLICANTS).
export const UpdateFormSchema = z
  .strictObject({ ...fields, questions: QuestionsInputSchema.optional() })
  .refine(isValidForm)
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
  'form.activate',
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
  // 초안만 비어 있을 수 있다(행사 시작이 미정일 때). 비었으면 missingConditions에 closes_at이 있다.
  closesAt: string | null
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
  // 신청자 정보를 지우는 날(한국 날짜 YYYY-MM-DD). 행사 일시도 마감도 없는 초안은 셀 근거가 없어 null이다.
  purgeOn: string | null
  // 서버가 활성화 시 검사하는 부족 조건. 읽기 권한과 무관하게 모든 운영진에게 준다.
  missingConditions: FormActivationCondition[]
  // 신청자가 답할 질문(차례대로). 이름·학번·휴대폰 칸 밖의 받는 항목이다.
  questions: FormQuestion[]
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
  // 고지의 받는 항목에 질문 제목이 실린다(DEC-93).
  questions: FormQuestion[]
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
  commandId: commandIdInput,
  name: text(REGISTRATION_FORM_NAME_MAX),
  studentId: token(STUDENT_ID_INPUT_MAX)
    .refine(value => STUDENT_ID_PATTERN.test(value))
    .nullable()
    .default(null),
  phone: phone.nullable().default(null),
  // 양식의 질문마다 답 하나. 질문이 없는 양식은 비운다.
  answers: AnswersSchema.default([]),
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
// 행사 일시·장소는 공개 양식과 같은 값이다. 다른 기기에서 열어도 당일(입장 QR 맨 위)과 행사 정보를 정할 수 있게 함께 준다.
export interface MyRegistration {
  event: PublicRegistrationForm['event']
  form: Pick<PublicRegistrationForm['form'], 'notice'>
  // 신청자 정보를 지우는 날(한국 날짜 YYYY-MM-DD, 공개 양식의 purgeOn과 같다). 셀 근거(행사 일시, 양식 마감)가 모두 없으면 null이다.
  purgeOn: string | null
  mine: { name: string; studentId: string | null; phone: string | null }
  // 내가 낸 답(질문마다 하나)
  answers: ShownAnswer[]
  appliedFee: number
  // 자기 신청의 현재 입금 확인 여부만 준다. 입금액·환불 내역은 공개하지 않는다.
  depositConfirmed: boolean
  account: { bank: string; accountNumber: string; holder: string } | null
  qrText: string
  attended: boolean
  // 마감 전이고 출석 전이면 스스로 취소할 수 있다(멈춤이어도).
  cancellable: boolean
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
  // 같은 행사(양식 여럿 포함)에 취소하지 않은 같은 학번이 둘 이상이다. 같은 양식 안은 신청에서 막고(DEC-107) 다른 양식 사이는 드러낸다(DEC-26·DEC-67).
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
// 출석 취소. [입장 안 함]은 이번 찍기가 남긴 출석 번호를 보내, 그 출석이 아직 지금 출석일 때만 취소한다.
// 그사이 다른 운영진이 취소·재출석했으면 남이 만든 출석을 취소하지 않고 409 ATTENDANCE_CHANGED다. 명단의 [출석 취소]는 번호 없이 지금 출석을 취소한다.
export const CancelAttendanceSchema = z.strictObject({ attendanceId: recordIdInput.optional() })
export type CancelAttendanceRequest = z.infer<typeof CancelAttendanceSchema>
// 출석 확인 결과. 스캔한 사람에게 이름과 학번을 크게 보여 준다. 이미 출석이면 오류가 아니라 already다.
export interface CheckInResult {
  registrationId: string
  // 지금 출석의 번호. 이번에 만들었으면 새 출석, already면 앞서 있던 출석이다. [입장 안 함]이 이것만 취소한다.
  attendanceId: string
  name: string
  studentId: string | null
  // 현장 입금 확인의 기본값. 이전 서버 응답과 공존할 때 없음을 무료로 해석하지 않는다.
  appliedFee?: number
  already: boolean
  // 이미 출석이면 처음 출석한 시각(ISO). 문 앞에서 같은 QR을 다시 쓴 것인지 가린다.
  checkedInAt?: string
  // 그 줄의 새 모습(이름·학번은 위에 이미 있고 열람 기록이 남는다)
  applicant: ApplicantChange
}
