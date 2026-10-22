import { and, eq } from 'drizzle-orm'
import type { Closing } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { accountClosing, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { cancelCarryover, carryOverFrom, nextPeriodOf } from './carryover.js'
import { publishGateOf, reopenGateOf } from './gates.js'
import { closingPeriodOf } from './period.js'
import { closingOf } from './queries.js'

// 공개와 다시 열기 거래. 학생회 행 잠금과 운영진 확인(inCouncilChange) 뒤에 부른다. 권한 → 기간 읽기 → 조건 → 쓰기 순서다(403이 409보다 먼저).
// 학생회 행 잠금이 이 쓰기들과 지출·수입 쓰기, 행사 완료를 한 줄로 세우므로 공개 조건을 읽은 값이 쓰는 동안 바뀌지 않는다.

// 이 기간의 결산 기록. 다시 열어도 기록은 남고 공개 시각만 비므로 한 기간에 하나다.
async function closingRecordOf(tx: Tx, actor: Actor, periodId: string) {
  const [row] = await tx
    .select({ id: accountClosing.id })
    .from(accountClosing)
    .innerJoin(record, eq(record.id, accountClosing.id))
    .where(and(eq(accountClosing.fiscalPeriodId, periodId), eq(record.councilId, actor.councilId)))
  return row ?? null
}

// 공개: 결산 기록(처음이면 만든다)의 공개 시각이 차고, 다음 기간이 있으면 이월금 수입이 같은 거래에 생긴다. 응답은 그 결산서다.
export async function publishClosing(
  tx: Tx,
  actor: Actor,
  periodId: string,
  now: Date,
): Promise<Closing> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const period = await closingPeriodOf(tx, actor, periodId)
  const { blocker, remaining } = await publishGateOf(tx, actor, period, now)
  if (blocker) throw new ApiError(blocker)
  const existing = await closingRecordOf(tx, actor, period.id)
  if (existing)
    await updateRecord(tx, {
      kind: 'account_closing',
      id: existing.id,
      actor: actor.memberId,
      reason: null,
      changes: { publishedAt: clockNow },
    })
  else
    await createRecord(tx, {
      kind: 'account_closing',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: { fiscalPeriodId: period.id, publishedAt: clockNow },
    })
  await carryOverFrom(tx, actor, period, remaining)
  return closingOf(tx, actor, period.id, now)
}

// 다시 열기: 사유가 꼭 있고(계약이 거른다) 판과 이월금 취소에 같은 사유가 남는다. 다음 기간 결산이 공개됐으면 막는다(그것부터 다시 연다).
export async function reopenClosing(
  tx: Tx,
  actor: Actor,
  periodId: string,
  input: { reason: string; now: Date },
): Promise<Closing> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const period = await closingPeriodOf(tx, actor, periodId)
  const blocker = await reopenGateOf(tx, actor, period)
  if (blocker) throw new ApiError(blocker)
  const existing = await closingRecordOf(tx, actor, period.id)
  if (!existing) throw new ApiError('CLOSING_NOT_PUBLISHED')
  const next = await nextPeriodOf(tx, actor, period.id)
  await updateRecord(tx, {
    kind: 'account_closing',
    id: existing.id,
    actor: actor.memberId,
    reason: input.reason,
    changes: { publishedAt: null },
  })
  if (next) await cancelCarryover(tx, actor, next.id, input.reason)
  return closingOf(tx, actor, period.id, input.now)
}
