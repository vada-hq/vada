import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { HOME_LIST_LIMIT, type HomeList, type TaskSummary } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { inCouncil, summaryOf, taskSelect, unassignedCondition } from '../tasks/queries.js'

type Reader = Pick<Db, 'select'>

export interface OpenTask {
  summary: TaskSummary
  unassigned: boolean
}

// 이 학생회의 끝나지 않은 업무 모두(마감 순, 업무 목록과 같은 정렬). 부서와 행사의 수가 한 번의 읽기에서 나온다.
// 지남은 summaryOf의 overdue(isOverdue), 담당자 없음은 업무 화면과 같은 조건(unassignedCondition)이라 SQL을 다시 쓰지 않는다(자주 잡힌 것 9).
// 학생회 하나의 열린 업무라 모두 읽는다(수백 개).
export async function openTasksOf(db: Reader, actor: Actor, now: Date): Promise<OpenTask[]> {
  const rows = await taskSelect(db, actor, now)
    .where(and(inCouncil(actor), ne(task.status, 'done')))
    .orderBy(sql`${task.dueAt} asc nulls last`, asc(record.createdAt), asc(task.id))
  const unassigned = await db
    .select({ id: task.id })
    .from(task)
    .innerJoin(record, eq(record.id, task.id))
    .where(and(inCouncil(actor), ne(task.status, 'done'), unassignedCondition(db, actor, now)))
  const unassignedIds = new Set(unassigned.map(row => row.id))
  return rows.map(row => ({
    summary: summaryOf(actor, row, now),
    unassigned: unassignedIds.has(row.id),
  }))
}

// 상한까지의 줄과 전체 수
export const listOf = (items: OpenTask[]): HomeList => ({
  tasks: items.slice(0, HOME_LIST_LIMIT).map(item => item.summary),
  total: items.length,
})
