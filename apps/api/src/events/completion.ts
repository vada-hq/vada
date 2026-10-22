import { and, asc, eq, inArray } from 'drizzle-orm'
import type { SettlementApproval } from '@vada/contracts'
import { approval, member } from '../db/schema.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>

const COMPLETION_OUTCOMES = ['completed', 'completion_cancelled']

// 행사의 완료는 저장하지 않고 센다: 그 행사에 대한 마지막 결재(완료, 완료 취소)가 완료이면 완료다(logical-model '행사의 완료').
// 행사 번호는 호출하는 쪽이 이미 학생회를 확인한 것만 넘긴다.
export async function completedEventIdsAmong(db: Reader, eventIds: string[]): Promise<Set<string>> {
  if (!eventIds.length) return new Set()
  // 행사마다 결재는 많지 않아 다 읽고 마지막 것을 고른다.
  const rows = await db
    .select({ id: approval.targetId, outcome: approval.outcome })
    .from(approval)
    .where(
      and(
        eq(approval.targetKind, 'event'),
        inArray(approval.targetId, eventIds),
        inArray(approval.outcome, COMPLETION_OUTCOMES),
      ),
    )
    .orderBy(asc(approval.actedAt), asc(approval.id))
  const last = new Map<string, string>()
  for (const row of rows) last.set(row.id, row.outcome)
  return new Set([...last].filter(([, outcome]) => outcome === 'completed').map(([id]) => id))
}

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
      actorName: member.name,
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
