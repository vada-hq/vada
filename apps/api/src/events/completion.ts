import { and, asc, eq, inArray } from 'drizzle-orm'
import type { SettlementApproval } from '@vada/contracts'
import { approval, event, member } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'

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

// 완료한 행사의 기록 잠금(DEC-68). 행사에 닿는 쓰기 거래는 모두 권한을 본 뒤, 쓰기 전에 이것을 부른다(403이 409보다 먼저다).
// 행사 행을 FOR SHARE로 잠근 뒤에 읽으므로, 완료와 겹치면(완료는 행사 행을 잠근다) 완료가 끝난 값을 보고 하나로 정해진다.
// 공개 신청과 스스로 취소는 학생회 행을 잠그지 않아(선착순이 다른 변경 뒤에 줄 서지 않게) 이 행 잠금이 완료와 만나는 유일한 곳이다.
// 행사 여럿은 번호 순서로 잠가 서로 기다리는 일이 없게 한다. 행사가 없는 쓰기(상시 지출 등)는 null을 넘기면 건너뛴다.
export async function assertEventsOpen(
  tx: Tx,
  eventIds: readonly (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(eventIds.filter((id): id is string => !!id))].sort()
  if (!ids.length) return
  await tx
    .select({ id: event.id })
    .from(event)
    .where(inArray(event.id, ids))
    .orderBy(asc(event.id))
    .for('share')
  if ((await completedEventIdsAmong(tx, ids)).size) throw new ApiError('EVENT_COMPLETED')
}

// 행사 하나가 열려 있어야 하는 쓰기
export const assertEventOpen = (tx: Tx, eventId: string | null | undefined) =>
  assertEventsOpen(tx, [eventId])

// 완료와 완료 취소가 부른다: 행사 행을 잠가 행사에 닿는 쓰기가 끝난 뒤에, 그리고 그 쓰기가 완료 상태를 읽기 전에 정한다.
// FOR NO KEY UPDATE는 FOR SHARE와 부딪히지만 이 행사를 가리키는 기록(업무, 양식)을 넣을 때의 외래 키 검사(FOR KEY SHARE)는 막지 않는다.
export async function lockEventForCompletion(tx: Tx, eventId: string): Promise<void> {
  await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for('no key update')
}
