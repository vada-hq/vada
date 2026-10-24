import { asc, eq } from 'drizzle-orm'
import type { TaskResult, TaskResultKind } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { record, request, taskResult } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { stagesOf } from './result-sync.js'

type Reader = Pick<Db, 'select'>

// 업무 상세의 결과물: 이 업무에서 만든 것을 만든 순으로, 제목은 지금 제목이고 단계는 그때그때 센다(저장하지 않는다).
// 지금은 구매 요청만이다. 신청 양식·공지·행사는 조각 4가 종류별 줄을 더한다.
export async function resultsOf(db: Reader, taskId: string): Promise<TaskResult[]> {
  const rows = await db
    .select({ id: taskResult.resultId, kind: taskResult.resultKind, title: request.title })
    .from(taskResult)
    .innerJoin(request, eq(request.id, taskResult.resultId))
    .innerJoin(record, eq(record.id, taskResult.resultId))
    .where(eq(taskResult.taskId, taskId))
    .orderBy(asc(record.createdAt), asc(taskResult.resultId))
  const results = rows.map(row => ({ id: row.id, kind: row.kind as TaskResultKind }))
  const stages = await stagesOf(db, results)
  return rows.map(row => ({
    kind: row.kind as TaskResultKind,
    id: row.id,
    title: row.title,
    stage: stages.get(row.id) ?? 'none',
  }))
}

// 이 업무에서 만들 수 있는 결과물 종류. 업무를 이을 수 있고(canLinkResult를 부르는 쪽이 넘긴다) 그 결과물을 만들 권한이 있을 때다.
// 지금은 구매 요청(purchase.request)뿐이다.
export function canMakeOf(actor: Actor, linkable: boolean): TaskResultKind[] {
  return linkable && can(actor, 'purchase.request') ? ['request'] : []
}
