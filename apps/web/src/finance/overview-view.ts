import type { Closing } from '@vada/contracts'

const PERCENT = 100

const sum = (lines: { budget: number }[]) => lines.reduce((total, line) => total + line.budget, 0)

// 집행률(%): 쓴 돈 ÷ 예산, 반올림. 예산이 0이면 없다(결산서 줄의 rate와 같은 규칙).
export const rateOf = (spent: number, budget: number) =>
  budget > 0 ? Math.round((spent * PERCENT) / budget) : null

// 재정 개요의 수. 총예산은 재원(수입 예산 항목)의 합이다(와이어프레임 FIN-00 '총예산은 재원의 합').
// 남은 예산과 집행률은 지출 예산 항목의 합과 이 기간 지출 전체(항목 없는 지출 포함)로 셈한다.
export function overviewOf(closing: Closing) {
  const expenseBudget = sum(closing.expense.items)
  const spent = closing.expense.total
  return {
    total: sum(closing.income.items),
    sources: closing.income.items.map(item => item.purpose),
    expenseBudget,
    spent,
    left: expenseBudget - spent,
    rate: rateOf(spent, expenseBudget),
  }
}

// '학생회비 외 1건'
export function sourcesLabel(sources: string[]) {
  const [first, ...rest] = sources
  if (first === undefined) return null
  return rest.length === 0 ? first : `${first} 외 ${rest.length}건`
}
