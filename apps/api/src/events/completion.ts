import { and, asc, eq, inArray } from 'drizzle-orm'
import type { SettlementApproval } from '@vada/contracts'
import { approval, member } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { displayNameOf, recordCouncilSql } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

const COMPLETION_OUTCOMES = ['completed', 'completion_cancelled']

// 행사 잠금(완료 여부와 행 잠금)의 판단은 policy/locks.ts 한 곳에 있다. 이 경로로 부르는 호출부(기능 014까지)가 있다.
export {
  assertEventOpen,
  assertEventsOpen,
  completedEventIdsAmong,
  lockedCompleted,
} from '../policy/locks.js'

// 완료와 완료 취소 결재를 오래된 것부터 모두.
export async function completionApprovalsOf(
  db: Reader,
  eventId: string,
): Promise<SettlementApproval[]> {
  const rows = await db
    .select({
      outcome: approval.outcome,
      actedAt: approval.actedAt,
      reason: approval.reason,
      actorId: approval.actorId,
      actorName: displayNameOf(member, recordCouncilSql(eventId)),
    })
    .from(approval)
    .leftJoin(member, eq(member.id, approval.actorId))
    .where(
      and(
        eq(approval.targetId, eventId),
        eq(approval.targetKind, 'event'),
        inArray(approval.outcome, COMPLETION_OUTCOMES),
      ),
    )
    .orderBy(asc(approval.actedAt), asc(approval.id))
  return rows.map(row => ({
    outcome: row.outcome as SettlementApproval['outcome'],
    by: row.actorName ? { id: row.actorId, name: row.actorName } : null,
    at: row.actedAt.toISOString(),
    reason: row.reason,
  }))
}
