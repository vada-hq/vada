import type { BudgetItemType, BudgetItemView, BudgetResponse } from '@vada/contracts'

// 회계 기간 만들기와 예산 항목 더하기 폼의 값. 입력칸 값은 글자다.
export type PeriodValues = { name: string; startsOn: string; endsOn: string }
export type BudgetItemValues = {
  purpose: string
  amount: string
  // 지출이 기본이다. 수입 항목은 결재와 지출에서 고를 수 없다.
  type: BudgetItemType
  eventId: string | null
}

// 지금 기수의 이름과 날짜로 채워 둔다. 서버가 못 줬으면 빈칸이다.
export const periodDefaults = (suggested: BudgetResponse['suggested']): PeriodValues =>
  suggested ?? { name: '', startsOn: '', endsOn: '' }

export const emptyBudgetItem = (eventId: string | null = null): BudgetItemValues => ({
  purpose: '',
  amount: '',
  type: 'expense',
  eventId,
})

// 결재와 지출에서 고를 수 있는 예산 항목은 지출 항목뿐이다(DEC-45).
export const expenseItems = <T extends Pick<BudgetItemView, 'type'>>(items: readonly T[]) =>
  items.filter(item => item.type === 'expense')

// 금액 칸: 쉼표와 공백은 지우고, 비었거나 숫자가 아니면 NaN이라 계약 검사가 막는다.
export function wonOf(value: string) {
  const digits = value.replace(/[,\s]/g, '')
  // 1e3, 0x10 같은 글은 Number가 받아도 숫자 입력이 아니다.
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN
}

export const budgetItemOf = (values: BudgetItemValues) => ({
  purpose: values.purpose,
  amount: wonOf(values.amount),
  type: values.type,
  eventId: values.eventId,
})

// 기간 표시 '2026-03-01 ~ 2026-08-31'
export const periodRange = (period: { startsOn: string; endsOn: string }) =>
  `${period.startsOn} ~ ${period.endsOn}`
