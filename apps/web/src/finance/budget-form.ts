import type { BudgetResponse } from '@vada/contracts'

// 회계 기간 만들기와 예산 항목 더하기 폼의 값. 입력칸 값은 글자다.
export type PeriodValues = { name: string; startsOn: string; endsOn: string }
export type BudgetItemValues = { purpose: string; amount: string }

// 지금 기수의 이름과 날짜로 채워 둔다. 서버가 못 줬으면 빈칸이다.
export const periodDefaults = (suggested: BudgetResponse['suggested']): PeriodValues =>
  suggested ?? { name: '', startsOn: '', endsOn: '' }

export const emptyBudgetItem = (): BudgetItemValues => ({ purpose: '', amount: '' })

// 금액 칸: 쉼표와 공백은 지우고, 비었거나 숫자가 아니면 NaN이라 계약 검사가 막는다.
export function wonOf(value: string) {
  const digits = value.replace(/[,\s]/g, '')
  return digits === '' ? Number.NaN : Number(digits)
}

export const budgetItemOf = (values: BudgetItemValues) => ({
  purpose: values.purpose,
  amount: wonOf(values.amount),
})

// 기간 표시 '2026-03-01 ~ 2026-08-31'
export const periodRange = (period: { startsOn: string; endsOn: string }) =>
  `${period.startsOn} ~ ${period.endsOn}`
