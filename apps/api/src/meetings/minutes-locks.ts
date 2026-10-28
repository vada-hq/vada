import { and, eq, isNull } from 'drizzle-orm'
import { agendaItem, decision } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { versionOf } from './queries.js'

// 회의 잠금 다음에 대상 잠금을 잡아 판 비교부터 쓰기까지 같은 거래에서 지킨다.
export async function lockedAgenda(tx: Tx, meetingId: string, id: string) {
  const [row] = await tx
    .select()
    .from(agendaItem)
    .where(
      and(
        eq(agendaItem.id, id),
        eq(agendaItem.meetingId, meetingId),
        isNull(agendaItem.cancelledAt),
      ),
    )
    .for('no key update')
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}
export async function lockedDecision(tx: Tx, meetingId: string, id: string) {
  const [row] = await tx
    .select({ decision })
    .from(decision)
    .innerJoin(agendaItem, eq(agendaItem.id, decision.originId))
    .where(
      and(
        eq(decision.id, id),
        eq(decision.originKind, 'agenda_item'),
        eq(agendaItem.meetingId, meetingId),
        isNull(agendaItem.cancelledAt),
        isNull(decision.cancelledAt),
      ),
    )
    .for('no key update', { of: decision })
  if (!row) throw new ApiError('NOT_FOUND')
  return row.decision
}
export async function assertVersion(tx: Tx, id: string, version: number) {
  if ((await versionOf(tx, id)) !== version) throw new ApiError('VERSION_CONFLICT')
}

export function changedFields<T extends object>(
  before: T,
  changes: { [K in keyof T]?: T[K] | undefined },
) {
  return Object.fromEntries(
    Object.entries(changes).filter(
      ([key, value]) => value !== undefined && value !== before[key as keyof T],
    ),
  ) as Partial<T>
}
