import {
  eventsAgree,
  type BudgetItemType,
  type BudgetItemView,
  type BudgetResponse,
} from '@vada/contracts'
import { wonOf } from '@/lib/won-input'

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

// 결재와 지출에서 고를 수 있는 예산 항목은 서버가 고를 수 있다고 한(selectable: 완료한 행사의 항목이 아닌) 지출 항목뿐이다(DEC-45).
type Pickable = Pick<BudgetItemView, 'type' | 'selectable'>
export const expenseItems = <T extends Pickable>(items: readonly T[]) =>
  items.filter(item => item.type === 'expense' && item.selectable)

// 수입 적기에서 고를 수 있는 예산 항목은 고를 수 있는 수입 항목뿐이다.
export const incomeItems = <T extends Pickable>(items: readonly T[]) =>
  items.filter(item => item.type === 'income' && item.selectable)

// 그 행사(요청이나 지출의 행사)와 맞는 항목만. 둘 다 행사가 있으면 같아야 한다(DEC-81): 서버 승인·지출과 같은 술어다.
export const itemsForEvent = <T extends Pick<BudgetItemView, 'event'>>(
  items: readonly T[],
  eventId: string | null,
) => items.filter(item => eventsAgree(eventId, item.event?.id ?? null))

export const budgetItemOf = (values: BudgetItemValues) => ({
  purpose: values.purpose,
  amount: wonOf(values.amount),
  type: values.type,
  eventId: values.eventId,
})

// 기간 표시 '2026-03-01 ~ 2026-08-31'
export const periodRange = (period: { startsOn: string; endsOn: string }) =>
  `${period.startsOn} ~ ${period.endsOn}`
