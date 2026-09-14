import { and, eq, notInArray } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { budgetItems, budgetPeriods, budgetSources } from '../db/schema.ts'
import { Blocked } from '../errors.ts'
import type { BudgetPlanInput } from './budget-plan-input.ts'

export async function replaceBudgetPlan(
  db: Db,
  orgId: string,
  plan: BudgetPlanInput,
  newId: () => string,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [period] = await tx
      .select({ id: budgetPeriods.id })
      .from(budgetPeriods)
      .where(eq(budgetPeriods.orgId, orgId))
      .limit(1)
    if (period === undefined) {
      await tx.insert(budgetPeriods).values({
        id: newId(),
        orgId,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        updatedAt: now,
      })
    } else {
      await tx
        .update(budgetPeriods)
        .set({ startsOn: plan.startsOn, endsOn: plan.endsOn, updatedAt: now })
        .where(and(eq(budgetPeriods.orgId, orgId), eq(budgetPeriods.id, period.id)))
    }

    const knownSources = new Set(
      (
        await tx
          .select({ id: budgetSources.id })
          .from(budgetSources)
          .where(eq(budgetSources.orgId, orgId))
      ).map((row) => row.id),
    )
    const keptSources: string[] = []
    for (const [sortOrder, row] of plan.sources.entries()) {
      if (row.id === null) {
        const id = newId()
        await tx.insert(budgetSources).values({
          id,
          orgId,
          name: row.name,
          amount: row.amount,
          sortOrder,
        })
        keptSources.push(id)
      } else {
        if (!knownSources.has(row.id)) throw new Blocked('이 학생회에 없는 수입원 줄입니다')
        await tx
          .update(budgetSources)
          .set({ name: row.name, amount: row.amount, sortOrder })
          .where(and(eq(budgetSources.orgId, orgId), eq(budgetSources.id, row.id)))
        keptSources.push(row.id)
      }
    }
    await tx
      .delete(budgetSources)
      .where(
        keptSources.length === 0
          ? eq(budgetSources.orgId, orgId)
          : and(eq(budgetSources.orgId, orgId), notInArray(budgetSources.id, keptSources)),
      )

    const knownItems = new Set(
      (
        await tx
          .select({ id: budgetItems.id })
          .from(budgetItems)
          .where(eq(budgetItems.orgId, orgId))
      ).map((row) => row.id),
    )
    const keptItems: string[] = []
    for (const [sortOrder, row] of [...plan.items, ...plan.eventItems].entries()) {
      const values = {
        name: row.name,
        amount: row.amount,
        eventId: row.eventId,
        departmentId: row.departmentId,
        sortOrder,
      }
      if (row.id === null) {
        const id = newId()
        await tx.insert(budgetItems).values({ id, orgId, ...values })
        keptItems.push(id)
      } else {
        if (!knownItems.has(row.id)) throw new Blocked('이 학생회에 없는 예산 항목 줄입니다')
        await tx
          .update(budgetItems)
          .set(values)
          .where(and(eq(budgetItems.orgId, orgId), eq(budgetItems.id, row.id)))
        keptItems.push(row.id)
      }
    }
    await tx
      .delete(budgetItems)
      .where(
        keptItems.length === 0
          ? eq(budgetItems.orgId, orgId)
          : and(eq(budgetItems.orgId, orgId), notInArray(budgetItems.id, keptItems)),
      )
  })
}
