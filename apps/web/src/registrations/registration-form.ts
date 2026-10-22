import type { RegistrationForm } from '@vada/contracts'

// 양식 만들기·고치기 폼의 값. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
// 일시는 datetime-local 값('YYYY-MM-DDTHH:mm')이라 계약의 한국 시각과 글자가 같다.
export type FormValues = {
  name: string
  opensAt: string
  closesAt: string
  capacity: string
  notice: string
  collectsPhone: boolean
  payerFee: string
  nonPayerFee: string
}

export const emptyFormValues: FormValues = {
  name: '',
  opensAt: '',
  closesAt: '',
  capacity: '',
  notice: '',
  collectsPhone: false,
  payerFee: '',
  nonPayerFee: '',
}

const textOf = (value: number | string | null) => (value === null ? '' : String(value))

export const valuesOfForm = (form: RegistrationForm): FormValues => ({
  name: form.name,
  opensAt: form.opensAt ?? '',
  closesAt: form.closesAt,
  capacity: textOf(form.capacity),
  notice: form.notice ?? '',
  collectsPhone: form.collectsPhone,
  payerFee: textOf(form.payerFee),
  nonPayerFee: textOf(form.nonPayerFee),
})

const DIGITS = /^[0-9]+$/
// 숫자 칸. 비웠으면 null이고, 숫자가 아닌 글은 그대로 보내 계약이 거절하게 한다(버튼이 꺼진다).
function numberOf(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return null
  return DIGITS.test(trimmed) ? Number(trimmed) : trimmed
}

// 참가비가 0보다 큰 칸이 있으면 계좌가 있어야 한다(서버 규칙). 둘 다 0이거나 없으면 계좌를 보내지 않는다.
export const hasFee = (values: Pick<FormValues, 'payerFee' | 'nonPayerFee'>) =>
  [values.payerFee, values.nonPayerFee].some(value => Number(value.trim() || 0) > 0)

export const formRequest = (values: FormValues, feeAccountId: string | null) => ({
  name: values.name,
  opensAt: values.opensAt === '' ? null : values.opensAt,
  closesAt: values.closesAt,
  capacity: numberOf(values.capacity),
  notice: values.notice.trim() === '' ? null : values.notice,
  collectsPhone: values.collectsPhone,
  payerFee: numberOf(values.payerFee),
  nonPayerFee: numberOf(values.nonPayerFee),
  feeAccountId: hasFee(values) ? feeAccountId : null,
})
