import type { FinanceOverviewExpense } from '@vada/contracts'

const PERCENT = 100
// 맨 위 집행률은 소수 한 자리(와이어프레임 FIN-00 '41.3%'), 행사 줄은 정수다.
const TENTHS = 10

export const NO_INCOME_BUDGET = '수입 예산 없음'

// 수입 예산이 없으면 사용 가능(DEC-92 식은 그대로)은 지출을 뒤집은 음수일 뿐 남은 돈이라는 뜻이 없어, 어디서나 금액 대신 NO_INCOME_BUDGET을 쓴다.
// 응답의 sources가 없는 홈과 같은 판정을 쓰려고 총예산으로 본다(집행률 rateOf와 같은 기준).
export const hasIncomeBudget = (total: number) => total > 0

// 집행률(%): 쓴 돈 ÷ 예산. 예산이 0 이하면 없다.
export const rateOf = (spent: number, budget: number) =>
  budget > 0 ? Math.round((spent * PERCENT * TENTHS) / budget) / TENTHS : null

export const wholeRateOf = (spent: number, budget: number) =>
  budget > 0 ? Math.round((spent * PERCENT) / budget) : null

// '학생회비 외 1건'
export function sourcesLabel(sources: string[]) {
  const [first, ...rest] = sources
  if (first === undefined) return null
  return rest.length === 0 ? first : `${first} 외 ${rest.length}건`
}

// 최근 지출의 '행사 또는 사용처' 칸: 행사가 있으면 행사, 없으면 사용처(와이어프레임 FIN-00 열 이름).
export const placeOf = (expense: FinanceOverviewExpense) => expense.event?.name ?? expense.vendor
