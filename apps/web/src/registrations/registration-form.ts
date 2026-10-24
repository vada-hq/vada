import type { EventDetail, PublicRegistrationForm, RegistrationForm } from '@vada/contracts'

// 참가비를 어떻게 받는지. 공지 사례는 참가비 하나가 가장 많고(13건), 학생회비 납부로 나누는 것은 적다(5건, RFC-11).
// 그래서 하나를 먼저 두고, 나눌 때만 두 칸을 연다. 나누면 학생이 학번을 낸다(DEC-67).
export type FeeKind = 'none' | 'one' | 'split'

// 양식 만들기·고치기 폼의 값. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
// 일시는 datetime-local 값('YYYY-MM-DDTHH:mm')이라 계약의 한국 시각과 글자가 같다.
export type FormValues = {
  name: string
  opensAt: string
  closesAt: string
  capacity: string
  notice: string
  collectsPhone: boolean
  // 학번 받기(DEC-75). 납부자 별도 금액이면 늘 받는다(collectsStudentId).
  collectsStudentId: boolean
  feeKind: FeeKind
  // feeKind가 one일 때의 참가비
  fee: string
  // feeKind가 split일 때의 두 참가비
  payerFee: string
  nonPayerFee: string
}

// 행사에 양식은 보통 하나라서(DEC-44 결과) 이름을 짓지 않아도 되게 채워 둔다.
export const DEFAULT_FORM_NAME = '참가 신청'

export const emptyFormValues: FormValues = {
  name: DEFAULT_FORM_NAME,
  opensAt: '',
  closesAt: '',
  capacity: '',
  notice: '',
  collectsPhone: false,
  collectsStudentId: true,
  feeKind: 'none',
  fee: '',
  payerFee: '',
  nonPayerFee: '',
}

const textOf = (value: number | string | null) => (value === null ? '' : String(value))

function feeValuesOf(form: Pick<RegistrationForm, 'payerFee' | 'nonPayerFee'>) {
  const { payerFee, nonPayerFee } = form
  if (payerFee === null || nonPayerFee === null)
    return { feeKind: 'none' as const, fee: '', payerFee: '', nonPayerFee: '' }
  if (payerFee === nonPayerFee)
    return { feeKind: 'one' as const, fee: String(payerFee), payerFee: '', nonPayerFee: '' }
  return {
    feeKind: 'split' as const,
    fee: '',
    payerFee: String(payerFee),
    nonPayerFee: String(nonPayerFee),
  }
}

export const valuesOfForm = (form: RegistrationForm): FormValues => ({
  name: form.name,
  opensAt: form.opensAt ?? '',
  closesAt: form.closesAt,
  capacity: textOf(form.capacity),
  notice: form.notice ?? '',
  collectsPhone: form.collectsPhone,
  collectsStudentId: form.collectsStudentId,
  ...feeValuesOf(form),
})

const DIGITS = /^[0-9]+$/
// 숫자 칸. 비웠으면 null이고, 숫자가 아닌 글은 그대로 보내 계약이 거절하게 한다(버튼이 꺼진다).
function numberOf(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return null
  return DIGITS.test(trimmed) ? Number(trimmed) : trimmed
}

// 요청의 두 참가비. 하나면 두 칸에 같은 값을 보낸다(같으면 학번을 받지 않는다, DEC-67).
function feesOf(values: FormValues) {
  if (values.feeKind === 'none') return { payerFee: null, nonPayerFee: null }
  if (values.feeKind === 'one')
    return { payerFee: numberOf(values.fee), nonPayerFee: numberOf(values.fee) }
  return { payerFee: numberOf(values.payerFee), nonPayerFee: numberOf(values.nonPayerFee) }
}

const amountOf = (value: string) => Number(value.trim() || 0)

// 참가비가 0보다 큰 칸이 있으면 계좌가 있어야 한다(서버 규칙). 없거나 0이면 계좌를 보내지 않는다.
export function hasFee(values: FormValues) {
  if (values.feeKind === 'none') return false
  if (values.feeKind === 'one') return amountOf(values.fee) > 0
  return amountOf(values.payerFee) > 0 || amountOf(values.nonPayerFee) > 0
}

// 학생이 학번을 내는지. 납부자 별도 금액이면 납부자 명단과 맞춰야 하므로 늘 받는다.
export const collectsStudentId = (values: FormValues) =>
  values.feeKind === 'split' || values.collectsStudentId

export const formRequest = (values: FormValues, feeAccountId: string | null) => ({
  name: values.name,
  opensAt: values.opensAt === '' ? null : values.opensAt,
  closesAt: values.closesAt,
  capacity: numberOf(values.capacity),
  notice: values.notice.trim() === '' ? null : values.notice,
  collectsPhone: values.collectsPhone,
  collectsStudentId: collectsStudentId(values),
  ...feesOf(values),
  feeAccountId: hasFee(values) ? feeAccountId : null,
})

export type FormErrorKey = 'name' | 'closesAt' | 'capacity' | 'fee' | 'payerFee' | 'nonPayerFee'
// 문제가 없는 칸은 빠지거나 undefined다.
export type FormErrors = Partial<Record<FormErrorKey, string | undefined>>

// 목적어는 조사까지 받는다(을/를).
const ENTER = (object: string) => `${object} 입력해 주세요`
const NUMBER_ONLY = '숫자만 입력해 주세요'

// 금액 칸 하나의 문제. 비었거나 숫자가 아니면 알린다.
function amountError(value: string, object: string) {
  if (value.trim() === '') return ENTER(object)
  return DIGITS.test(value.trim()) ? undefined : NUMBER_ONLY
}

function feeErrors(values: FormValues): FormErrors {
  if (values.feeKind === 'one') return { fee: amountError(values.fee, '참가비를') }
  if (values.feeKind === 'split')
    return {
      payerFee: amountError(values.payerFee, '납부자 참가비를'),
      nonPayerFee: amountError(values.nonPayerFee, '미납자 참가비를'),
    }
  return {}
}

// 만들기를 눌렀을 때 칸 아래에 보일 문제(GOV.UK: 버튼을 끄지 않고 보낼 때 확인한다).
// 길이 상한처럼 여기서 다루지 않는 규칙은 계약(safeParse)이 마지막에 막는다.
export function formErrors(values: FormValues): FormErrors {
  const { opensAt, closesAt, capacity } = values
  const errors: FormErrors = {
    name: values.name.trim() === '' ? ENTER('양식 이름을') : undefined,
    closesAt:
      closesAt === ''
        ? ENTER('신청 마감을')
        : opensAt !== '' && closesAt <= opensAt
          ? '신청 시작보다 늦은 시각을 입력해 주세요'
          : undefined,
    capacity:
      capacity.trim() !== '' && !(DIGITS.test(capacity.trim()) && Number(capacity) > 0)
        ? '1 이상의 숫자를 입력해 주세요'
        : undefined,
    ...feeErrors(values),
  }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}

// 신청자 정보를 지우는 날(DEC-55): 행사 끝(없으면 시작, 없으면 양식 마감)의 날짜 + 1년. 서버 purgeOnOf와 같은 규칙이다.
function purgeOnOf(event: Pick<EventDetail, 'startsAt' | 'endsAt'>, closesAt: string) {
  const base = (event.endsAt ?? event.startsAt ?? closesAt).slice(0, 10)
  const [year, month, day] = base.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10)
}

// 만드는 중인 양식이 학생에게 어떻게 보이는지. 공개 신청 화면과 같은 모양의 값을 만든다(받는 중으로 본다).
export function previewOf(
  values: FormValues,
  event: Pick<EventDetail, 'name' | 'startsAt' | 'endsAt' | 'place'>,
  councilName: string,
): PublicRegistrationForm {
  const request = formRequest(values, null)
  const number = (value: number | string | null) => (typeof value === 'number' ? value : null)
  const fees = { payerFee: number(request.payerFee), nonPayerFee: number(request.nonPayerFee) }
  const paired = fees.payerFee !== null && fees.nonPayerFee !== null
  return {
    councilName,
    event: { name: event.name, startsAt: event.startsAt, endsAt: event.endsAt, place: event.place },
    form: {
      name: values.name.trim() || DEFAULT_FORM_NAME,
      opensAt: request.opensAt,
      closesAt: values.closesAt,
      notice: request.notice,
    },
    status: 'open',
    remaining: number(request.capacity),
    payerFee: paired ? fees.payerFee : null,
    nonPayerFee: paired ? fees.nonPayerFee : null,
    collectsStudentId: collectsStudentId(values),
    collectsPhone: values.collectsPhone,
    purgeOn: purgeOnOf(event, values.closesAt) ?? '',
  }
}
