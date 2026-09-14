import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events } from '../db/schema.ts'
import { Blocked } from '../errors.ts'
import type { BudgetPlanInput } from './budget-plan-input.ts'

export async function validateBudgetPlanReferences(
  db: Db,
  orgId: string,
  plan: BudgetPlanInput,
): Promise<void> {
  const allItems = [...plan.items, ...plan.eventItems]
  const wantedDepartments = [
    ...new Set(allItems.map((row) => row.departmentId).filter((id): id is string => id !== null)),
  ]
  if (wantedDepartments.length > 0) {
    const ours = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.orgId, orgId), inArray(departments.id, wantedDepartments)))
    const known = new Set(ours.map((row) => row.id))
    if (wantedDepartments.some((id) => !known.has(id))) {
      throw new Blocked('이 학생회에 없는 부서입니다')
    }
  }

  const wantedEvents = [...new Set(plan.eventItems.map((row) => row.eventId as string))]
  if (wantedEvents.length > 0) {
    const ours = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.orgId, orgId), inArray(events.id, wantedEvents)))
    const known = new Set(ours.map((row) => row.id))
    if (wantedEvents.some((id) => !known.has(id))) {
      throw new Blocked('이 학생회에 없는 행사입니다')
    }
  }
}
