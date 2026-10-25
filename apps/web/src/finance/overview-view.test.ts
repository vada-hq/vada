import { expect, test } from 'vitest'
import { closingFixture } from '@/test-support/closing-fixtures'
import { overviewOf, rateOf, sourcesLabel } from './overview-view'

const line = (purpose: string, budget: number, actual: number) => ({
  id: purpose,
  purpose,
  budget,
  actual,
  difference: budget - actual,
  rate: null,
})

test('총예산은 수입 예산 항목의 합이고, 남은 예산과 집행률은 지출 예산 합과 이 기간 지출 합으로 셈한다', () => {
  const closing = closingFixture({
    income: {
      ...closingFixture().income,
      items: [line('학생회비', 2_500_000, 2_000_000), line('학교 지원금', 500_000, 0)],
    },
    expense: {
      items: [line('체육대회', 1_000_000, 600_000), line('간식', 200_000, 50_000)],
      noItem: 30_000,
      otherPeriod: 0,
      total: 680_000,
    },
  })
  expect(overviewOf(closing)).toEqual({
    total: 3_000_000,
    sources: ['학생회비', '학교 지원금'],
    expenseBudget: 1_200_000,
    spent: 680_000,
    left: 520_000,
    rate: 57,
  })
})

test('지출 예산이 0이면 집행률은 없고, 예산보다 많이 쓰면 남은 예산은 음수다', () => {
  expect(rateOf(100, 0)).toBeNull()
  expect(rateOf(1, 3)).toBe(33)
  const over = closingFixture({
    expense: { items: [line('간식', 100, 150)], noItem: 0, otherPeriod: 0, total: 150 },
  })
  expect(overviewOf(over).left).toBe(-50)
  expect(overviewOf(over).rate).toBe(150)
})

test('재원 이름은 첫 이름과 나머지 수로 줄인다', () => {
  expect(sourcesLabel([])).toBeNull()
  expect(sourcesLabel(['학생회비'])).toBe('학생회비')
  expect(sourcesLabel(['학생회비', '학교 지원금', '후원'])).toBe('학생회비 외 2건')
})
