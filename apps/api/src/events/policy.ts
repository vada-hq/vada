import {
  EVENT_ACTIONS,
  type ErrorCode,
  type EventAction,
  type EventBlockers,
  type EventStatus,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import { feeIncomesLockedOf, feePeriodProblemOf, feePlanOf } from '../settlement/fee-income.js'
import { remainingOf } from '../settlement/remaining.js'
import { eventStatusOf } from './status.js'

type Reader = Pick<Db, 'select'>

// 행사 정책(기능 012): 화면에 주는 동작(actions, blockers)과 서버의 거절이 같은 decide에서 나온다.
// 읽기는 factsOf → actionsOf·blockersOf, 쓰기는 잠금을 잡은 뒤 같은 거래에서 factsOf → decide → 던짐이다.
// 규칙의 원문은 logical-model RULE-11(완료한 행사는 바꾸지 않는다), RULE-36(공개한 기간), RULE-42(완료와 완료 취소의 조건)다.

type FeePeriodProblem = Awaited<ReturnType<typeof feePeriodProblemOf>>

// 판정에 드는 사실. 동작 하나가 보지 않는 사실은 읽지 않아 기본값이다(decide는 앞선 검사가 막으면 그 사실에 닿지 않는다).
export type EventFacts = {
  ownerId: string | null
  status: EventStatus
  // 정산에 남은 것이 있는가(끝난 행사의 완료만 본다)
  settlementPending: boolean
  // 참가비 수입이 들어갈 기간의 첫 문제(끝났고 정산이 끝난 행사의 완료만 본다)
  feePeriodProblem: FeePeriodProblem
  // 그 행사 참가비 수입이 든 기간이 공개됐는가(완료한 행사의 완료 취소만 본다)
  completionPeriodClosed: boolean
}

// 동작 → 권한 키. 완료와 완료 취소는 같은 권한(회장단)이다.
export function roleAllows(actor: Actor, action: EventAction, ownerId: string | null = null) {
  if (action === 'event.update')
    return can(actor, 'event.update', ownerId ? { eventOwnerId: ownerId } : {})
  return can(actor, 'event.complete')
}

// 허용이면 null, 막으면 그 쓰기가 내는 첫 코드. 권한(403) → 상태(409) 순서다.
export function decide(actor: Actor, facts: EventFacts, action: EventAction): ErrorCode | null {
  if (!roleAllows(actor, action, facts.ownerId)) return 'FORBIDDEN'
  const completed = facts.status === 'completed'
  if (action === 'event.update') return completed ? 'EVENT_COMPLETED' : null
  if (action === 'event.cancel_completion') {
    if (!completed) return 'EVENT_NOT_COMPLETED'
    return facts.completionPeriodClosed ? 'PERIOD_CLOSED' : null
  }
  if (completed) return 'EVENT_COMPLETED'
  if (facts.status !== 'ended') return 'EVENT_NOT_ENDED'
  if (facts.settlementPending) return 'SETTLEMENT_PENDING'
  return facts.feePeriodProblem
}

type FactsRow = {
  id: string
  name: string
  ownerId: string | null
  startsAt: Date | null
  endsAt: Date | null
}

// 사실을 한 번 읽는다. 쓰기는 행사 행 잠금을 잡은 뒤 같은 거래에서 부른다. 읽기는 잠그지 않는다.
// actions는 이 동작들만 판정할 때 필요한 사실만 읽는다. 완료에 드는 사실은 회장단이 아니면 읽지 않는다(어차피 403이다).
export async function factsOf(
  db: Reader,
  actor: Actor,
  row: FactsRow,
  scope: { now: Date; actions?: readonly EventAction[] },
): Promise<EventFacts> {
  const { now, actions = EVENT_ACTIONS } = scope
  const completed = (await completedEventIdsAmong(db, [row.id])).has(row.id)
  const status = eventStatusOf(row.startsAt, row.endsAt, now, completed)
  const facts: EventFacts = {
    ownerId: row.ownerId,
    status,
    settlementPending: false,
    feePeriodProblem: null,
    completionPeriodClosed: false,
  }
  if (!roleAllows(actor, 'event.complete')) return facts
  if (status === 'completed' && actions.includes('event.cancel_completion'))
    facts.completionPeriodClosed = await feeIncomesLockedOf(db, actor, row.id)
  if (status === 'ended' && actions.includes('event.complete')) {
    const remaining = await remainingOf(db, { councilId: actor.councilId, eventId: row.id })
    facts.settlementPending = remaining.some(item => item.count > 0)
    if (!facts.settlementPending)
      facts.feePeriodProblem = await feePeriodProblemOf(
        db,
        actor,
        await feePlanOf(db, actor, { ...row, now }),
      )
  }
  return facts
}

// 화면에 줄 동작: decide가 허용하는 것
export const actionsOf = (actor: Actor, facts: EventFacts): EventAction[] =>
  EVENT_ACTIONS.filter(action => decide(actor, facts, action) === null)

// 역할은 있는데 상태가 막은 완료·완료 취소와 그 쓰기가 낼 코드. 회장단이 아니면 비어 있다.
// 이미 완료했거나(EVENT_COMPLETED) 완료한 행사가 아니라서(EVENT_NOT_COMPLETED) 자리를 다른 동작이 쓰는 경우는 막힌 이유가 아니라 빼고,
// 풀릴 수 있는 막힘(끝나기 전, 정산 남음, 기간 없음, 기간 공개)만 준다.
const NOT_BLOCKERS: readonly ErrorCode[] = ['FORBIDDEN', 'EVENT_COMPLETED', 'EVENT_NOT_COMPLETED']
export function blockersOf(actor: Actor, facts: EventFacts): EventBlockers {
  const blockers: EventBlockers = {}
  for (const action of ['event.complete', 'event.cancel_completion'] as const) {
    const code = decide(actor, facts, action)
    if (code && !NOT_BLOCKERS.includes(code)) blockers[action] = code
  }
  return blockers
}
