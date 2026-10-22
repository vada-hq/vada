import type { CreateIncome, FiscalPeriodSummary } from '@vada/contracts'
import { wonOf } from './budget-form'

// 수입 적기 폼의 값. 입력칸 값은 글자다. 출처는 사람이 적는 것만 고른다(참가비와 이월금은 서버가 만든다).
export type IncomeValues = {
  source: CreateIncome['source']
  amount: string
  receivedOn: string
  description: string
  budgetItemId: string | null
  // undefined는 사람이 아직 고르지 않은 것이라 화면이 대표 계좌로 보고, null은 '없음'을 고른 것이다(account-form.ts의 pickAccount).
  accountId: string | null | undefined
}

// 받은 날로 고를 수 있는 범위: 그 기간 안이고 오늘 뒤는 아니다. 기간이 아직 시작하지 않았으면 min이 max보다 늦다(고를 수 있는 날이 없다).
export const receivedRange = (
  period: Pick<FiscalPeriodSummary, 'startsOn' | 'endsOn'>,
  today: string,
) => ({
  min: period.startsOn,
  max: period.endsOn < today ? period.endsOn : today,
})

export const emptyIncome = (
  period: Pick<FiscalPeriodSummary, 'startsOn' | 'endsOn'>,
  today: string,
): IncomeValues => ({
  source: 'fee',
  amount: '',
  receivedOn: receivedRange(period, today).max,
  description: '',
  budgetItemId: null,
  accountId: undefined,
})

const blankToNull = (value: string) => (value.trim() === '' ? null : value)

// 서버로 보낼 본문. 계약 검사(CreateIncomeSchema)가 칸마다의 상한을 본다.
export const incomeOf = (values: IncomeValues) => ({
  source: values.source,
  amount: wonOf(values.amount),
  receivedOn: values.receivedOn,
  description: blankToNull(values.description),
  budgetItemId: values.budgetItemId,
  accountId: values.accountId ?? null,
})
