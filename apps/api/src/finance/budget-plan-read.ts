import { and, asc, eq, ne } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { budgetItems, budgetPeriods, budgetSources, departments, events } from '../db/schema.ts'
import { STATUS } from '../events/events.ts'

// ── 읽기 ────────────────────────────────────────────────────────────────

export interface BudgetSourceDraft {
  id: string
  sourceName: string
  sourceAmount: number
}

export interface BudgetItemDraft {
  id: string
  itemName: string
  itemAmount: number
  itemDepartment?: string
  /** 담당 부서의 이름. 값 곁에 함께 온다. */
  itemDepartmentName?: string
}

export interface BudgetEventItemDraft {
  id: string
  eventItemEvent: string
  /** 그 행사의 이름. **값 곁에 함께 온다** — 값은 id라 그것만으로는 그릴 말이 없다. */
  eventItemEventName: string
  eventItemName: string
  eventItemAmount: number
  eventItemDepartment?: string
  eventItemDepartmentName?: string
}

export interface BudgetPlanDraft {
  periodStart?: string
  periodEnd?: string
  sources: BudgetSourceDraft[]
  items: BudgetItemDraft[]
  eventItems: BudgetEventItemDraft[]
}

/**
 * 학생회의 편성 한 벌. **아직 아무것도 안 정한 학생회는 기간도 줄도 없이 온다** —
 * 조각을 비워 내지 않고 아예 내지 않는다. 그것이 갓 만든 학생회의 첫 모습이다.
 *
 * 금액은 **수**로 준다. 자릿점은 화면이 붙인다 — 화면이 합계를 다시 셈해야 하는
 * 자리라(`compute: sum`) 글로 주면 화면이 글을 수로 되돌려야 한다.
 */
export async function budgetPlanDraft(db: Db, orgId: string): Promise<BudgetPlanDraft> {
  const [period] = await db
    .select({ startsOn: budgetPeriods.startsOn, endsOn: budgetPeriods.endsOn })
    .from(budgetPeriods)
    .where(eq(budgetPeriods.orgId, orgId))
    .limit(1)
  const sources = await db
    .select({ id: budgetSources.id, name: budgetSources.name, amount: budgetSources.amount })
    .from(budgetSources)
    .where(eq(budgetSources.orgId, orgId))
    .orderBy(asc(budgetSources.sortOrder), asc(budgetSources.id))
  // **값 곁에 이름을 함께 싣는다.** 값은 id라 그것만 주면 첫 그림에 사람이 읽을 말이
  // 없고, 이름은 고르는 목록이 열릴 때에야 온다 — 그동안 화면은 빈 칸이었다.
  const items = await db
    .select({
      id: budgetItems.id,
      eventId: budgetItems.eventId,
      name: budgetItems.name,
      amount: budgetItems.amount,
      departmentId: budgetItems.departmentId,
      departmentName: departments.name,
      eventName: events.title,
    })
    .from(budgetItems)
    .leftJoin(
      departments,
      and(eq(budgetItems.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(events, and(eq(budgetItems.eventId, events.id), eq(events.orgId, orgId)))
    .where(eq(budgetItems.orgId, orgId))
    .orderBy(asc(budgetItems.sortOrder), asc(budgetItems.id))

  return {
    ...(period === undefined ? {} : { periodStart: period.startsOn, periodEnd: period.endsOn }),
    sources: sources.map((row) => ({ id: row.id, sourceName: row.name, sourceAmount: row.amount })),
    items: items
      .filter((row) => row.eventId === null)
      .map((row) => ({
        id: row.id,
        itemName: row.name,
        itemAmount: row.amount,
        ...(row.departmentId === null
          ? {}
          : {
              itemDepartment: row.departmentId,
              ...(row.departmentName === null ? {} : { itemDepartmentName: row.departmentName }),
            }),
      })),
    eventItems: items
      .filter((row): row is typeof row & { eventId: string } => row.eventId !== null)
      .map((row) => ({
        id: row.id,
        eventItemEvent: row.eventId,
        // 행사가 지워지면 이름이 없다 — 지어내지 않고 값을 그대로 보여 준다.
        eventItemEventName: row.eventName ?? row.eventId,
        eventItemName: row.name,
        eventItemAmount: row.amount,
        ...(row.departmentId === null
          ? {}
          : {
              eventItemDepartment: row.departmentId,
              ...(row.departmentName === null ? {} : { eventItemDepartmentName: row.departmentName }),
            }),
      })),
  }
}

export interface BudgetEventOption {
  value: string
  label: string
  description?: string
}

/**
 * 예산을 배정할 수 있는 행사. **완료된 행사는 오지 않는다** — 끝난 행사에 예산을
 * 새로 배정할 일이 없다. 행사에는 '취소'라는 단계가 없어(회의에만 있다) 빠지는 것은
 * `done` 하나다. 단계가 곁에 붙는다(description).
 */
export async function budgetEventOptions(db: Db, orgId: string): Promise<BudgetEventOption[]> {
  const rows = await db
    .select({ id: events.id, title: events.title, status: events.status })
    .from(events)
    .where(and(eq(events.orgId, orgId), ne(events.status, 'done')))
    .orderBy(asc(events.startAt), asc(events.title), asc(events.id))
  return rows.map((row) => {
    const stage = STATUS[row.status]?.label
    return { value: row.id, label: row.title, ...(stage === undefined ? {} : { description: stage }) }
  })
}
