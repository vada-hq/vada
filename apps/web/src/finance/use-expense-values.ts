import { sameJson } from '@/lib/same-json'
import { useBaselineValues } from '@/lib/use-baseline-values'
import type { ExpenseValues } from './expense-form'

// 마지막 자동값(auto)은 화면 안의 기록이라 사람이 보거나 보내는 값이 같으면 같은 것으로 본다.
const sameInput = (a: ExpenseValues, b: ExpenseValues) =>
  sameJson({ ...a, auto: null }, { ...b, auto: null })

// 지출 적기 폼의 값과 떠날 때 물을지 가르는 기준 값. 연결된 요청 골라 두기와 그 요청의 사유 채우기가 자동 변경이다.
export const useExpenseValues = (init: () => ExpenseValues) =>
  useBaselineValues(() => ({ values: init() }), sameInput)
