import { and, asc, eq, gte, inArray, isNotNull, lte, type SQL } from 'drizzle-orm'
import type { ErrorCode } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { accountClosing, approval, event, fiscalPeriod, record } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'

// 쓰기를 막는 두 공통 잠금의 자리: 행사 완료(RULE-11)와 결산을 공개한 회계 기간(RULE-36).
// 사실을 읽는 함수와, 그 사실에서 막는 코드를 내는 순수 판정(lockCodeOf)이 여기 있다. 읽기(actions)와 쓰기가 같은 것을 부른다.

type Reader = Pick<Db, 'select'>

const COMPLETION_OUTCOMES = ['completed', 'completion_cancelled']

// 행사의 완료는 저장하지 않고 센다: 그 행사에 대한 마지막 결재(완료, 완료 취소)가 완료이면 완료다(logical-model '행사의 완료').
// 행사 번호는 호출하는 쪽이 이미 학생회를 확인한 것만 넘긴다. 학생회를 주면 그 학생회의 결재만 본다(기록 메뉴).
export async function completedEventIdsAmong(
  db: Reader,
  eventIds: string[],
  councilId?: string,
): Promise<Set<string>> {
  if (!eventIds.length) return new Set()
  // 행사마다 결재는 많지 않아 다 읽고 마지막 것을 고른다.
  const rows = await db
    .select({ id: approval.targetId, outcome: approval.outcome })
    .from(approval)
    .innerJoin(record, eq(record.id, approval.id))
    .where(
      and(
        councilId === undefined ? undefined : eq(record.councilId, councilId),
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

// 두 잠금이 함께 걸리면 EVENT_COMPLETED가 먼저다(RULE-11이 RULE-36보다 앞).
export function lockCodeOf(facts: {
  eventCompleted: boolean
  periodClosed: boolean
}): ErrorCode | null {
  if (facts.eventCompleted) return 'EVENT_COMPLETED'
  return facts.periodClosed ? 'PERIOD_CLOSED' : null
}

// 완료한 행사의 기록 잠금(DEC-68). 행사에 닿는 쓰기 거래는 모두 권한을 본 뒤, 쓰기 전에 이것을 부른다(403이 409보다 먼저다).
// 행사 행을 FOR SHARE로 잠근 뒤에 읽으므로, 완료와 겹치면(완료는 행사 행을 잠근다) 완료가 끝난 값을 보고 하나로 정해진다.
// 공개 신청과 스스로 취소는 학생회 행을 잠그지 않아(선착순이 다른 변경 뒤에 줄 서지 않게) 이 행 잠금이 완료와 만나는 유일한 곳이다.
// 행사 여럿은 번호 순서로 잠가 서로 기다리는 일이 없게 한다. 행사가 없는 쓰기(상시 지출 등)는 null을 넘기면 건너뛴다.
export async function assertEventsOpen(
  tx: Tx,
  eventIds: readonly (string | null | undefined)[],
): Promise<void> {
  if (await lockedCompleted(tx, eventIds)) throw new ApiError('EVENT_COMPLETED')
}

// 행사 행을 FOR SHARE로 잠근 뒤 그 가운데 완료한 행사가 있는지 본다. 신청자가 보는 경로는 EVENT_COMPLETED 대신 007의 닫힘 코드를 내려고 이것을 쓴다.
export async function lockedCompleted(
  tx: Tx,
  eventIds: readonly (string | null | undefined)[],
): Promise<boolean> {
  const ids = await lockEventsShared(tx, eventIds)
  return (await completedEventIdsAmong(tx, ids)).size > 0
}

// 행사 행을 번호 순서로 FOR SHARE 잠근다. 잠근 행사 번호를 준다. 이 잠금을 잡은 채 읽어야 완료와 겹쳐도 하나로 정해진다.
export async function lockEventsShared(
  tx: Tx,
  eventIds: readonly (string | null | undefined)[],
): Promise<string[]> {
  const ids = [...new Set(eventIds.filter((id): id is string => !!id))].sort()
  if (!ids.length) return ids
  await tx
    .select({ id: event.id })
    .from(event)
    .where(inArray(event.id, ids))
    .orderBy(asc(event.id))
    .for('share')
  return ids
}

// 행사 하나가 열려 있어야 하는 쓰기
export const assertEventOpen = (tx: Tx, eventId: string | null | undefined) =>
  assertEventsOpen(tx, [eventId])

// 완료와 완료 취소가 부른다: 행사 행을 잠가 행사에 닿는 쓰기가 끝난 뒤에, 그리고 그 쓰기가 완료 상태를 읽기 전에 정한다.
// FOR NO KEY UPDATE는 FOR SHARE와 부딪히지만 이 행사를 가리키는 기록(업무, 양식)을 넣을 때의 외래 키 검사(FOR KEY SHARE)는 막지 않는다.
export async function lockEventForCompletion(tx: Tx, eventId: string): Promise<void> {
  await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for('no key update')
}

// 결산 공개 잠금(DEC-70)은 합계를 바꾸는 쓰기 경로(지출 적기·취소, 수입 적기·취소, 참가비 수입 만들기·취소)가 모두 이것을 부른다.
// 쓰기는 학생회 행 잠금(inCouncilChange) 뒤에 부르므로 공개·다시 열기와 같은 학생회 안에서 한 줄로 선다.
async function publishedWhere(db: Reader, actor: Actor, where: SQL | undefined) {
  const [row] = await db
    .select({ id: accountClosing.id })
    .from(accountClosing)
    .innerJoin(fiscalPeriod, eq(fiscalPeriod.id, accountClosing.fiscalPeriodId))
    .where(
      and(
        eq(fiscalPeriod.councilId, actor.councilId),
        isNotNull(accountClosing.publishedAt),
        where,
      ),
    )
    .limit(1)
  return !!row
}

// 기간 하나가 공개돼 잠겼는가. 읽기(actions)와 쓰기가 같은 판단이다.
export const isPeriodClosed = (db: Reader, actor: Actor, periodId: string) =>
  publishedWhere(db, actor, eq(fiscalPeriod.id, periodId))

// 한국 날짜가 든 기간이 공개돼 잠겼는가. 그 날이 든 기간이 없으면 잠기지 않았다(기간이 없는 실패는 그것을 고르는 쪽이 낸다).
export const isDayClosed = (db: Reader, actor: Actor, day: string) =>
  publishedWhere(db, actor, and(lte(fiscalPeriod.startsOn, day), gte(fiscalPeriod.endsOn, day)))

export async function assertDayOpen(tx: Tx, actor: Actor, day: string) {
  if (await isDayClosed(tx, actor, day)) throw new ApiError('PERIOD_CLOSED')
}
