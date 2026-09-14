import type { Db } from '../db/client.ts'
import { parseBudgetPlanInput } from './budget-plan-input.ts'
import { validateBudgetPlanReferences } from './budget-plan-references.ts'
import { replaceBudgetPlan } from './budget-plan-storage.ts'

/**
 * 편성 한 벌을 저장한다(`finance.budgetPlan.save`).
 *
 * 입력을 검증한 뒤 조직 소유 참조를 확인하고, 기간·수입원·예산 항목을 한
 * 트랜잭션에서 덮어쓴다. 각 단계의 세부 규칙은 해당 모듈이 맡는다.
 */
export async function saveBudgetPlan(
  db: Db,
  orgId: string,
  body: unknown,
  newId: () => string,
  now: Date,
): Promise<Record<string, never>> {
  const plan = parseBudgetPlanInput(body)
  await validateBudgetPlanReferences(db, orgId, plan)
  await replaceBudgetPlan(db, orgId, plan, newId, now)
  return {}
}
