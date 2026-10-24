import {
  LINE_ITEM_ACTIONS,
  PURCHASE_ACTIONS,
  type ErrorCode,
  type LineItemAction,
  type LineItemStatus,
  type PurchaseAction,
  type PurchaseStatus,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../policy/locks.js'

type Reader = Pick<Db, 'select'>

// 구매 요청 정책(기능 014, 012의 꼴): 화면에 주는 동작(actions)과 서버의 거절이 같은 decide에서 나온다.
// 읽기는 factsOf → actionsOf, 쓰기는 잠금을 잡은 뒤 같은 거래에서 factsOf → decide → 던짐이다.
// 규칙의 원문은 logical-model '품목의 상태', '요청의 상태', RULE-9(되돌리지 않음), RULE-11(완료한 행사)이다.

// 요청 상태는 저장하지 않고 센다. 취소한 요청이면 취소, 결재 안 된 품목이 있으면 대기, 품목이 모두 취소면 취소,
// 승인(취소 안 된)이 없으면 반려, 모두 승인이면 승인, 나머지는 일부 승인이다.
export function requestStatusOf(
  cancelled: boolean,
  counts: { items: number; pending: number; approved: number; cancelled: number },
): PurchaseStatus {
  if (cancelled) return 'cancelled'
  if (counts.pending > 0) return 'pending'
  if (counts.cancelled === counts.items) return 'cancelled'
  if (counts.approved === 0) return 'rejected'
  return counts.approved === counts.items ? 'approved' : 'partial'
}

// 품목의 상태는 마지막 결재 결과다. 결재가 없으면 대기다.
export const lineItemStatusOf = (outcome: string | null): LineItemStatus =>
  outcome === 'approved' || outcome === 'rejected' || outcome === 'cancelled' ? outcome : 'pending'

// 판정에 드는 사실. factsOf가 늘 모두 읽는다.
export type RequestFacts = {
  requestedBy: string
  status: PurchaseStatus
  // 요청 자체를 취소했는가(품목이 모두 취소돼 상태가 취소인 것과 다르다)
  requestCancelled: boolean
  // 결재가 시작됐는가(결과가 있는 품목이 하나라도 있다)
  decided: boolean
  eventCompleted: boolean
}

type FactsRow = {
  requestedBy: string
  cancelledAt: Date | null
  eventId: string | null
  items: number
  pending: number
  approved: number
  cancelled: number
}

// 사실을 한 번 읽는다. 쓰기는 요청 행 잠금을 잡은 뒤 같은 거래에서 부른다.
export async function factsOf(db: Reader, row: FactsRow): Promise<RequestFacts> {
  const eventCompleted =
    !!row.eventId && (await completedEventIdsAmong(db, [row.eventId])).has(row.eventId)
  return {
    requestedBy: row.requestedBy,
    status: requestStatusOf(row.cancelledAt !== null, row),
    requestCancelled: row.cancelledAt !== null,
    decided: row.pending < row.items,
    eventCompleted,
  }
}

// 동작 → 권한. 동작 이름은 권한 키와 다르다(화면에 닿는 동작만 센다). 취소는 요청한 사람만이다(회장단도 아니다).
export const roleAllows = (actor: Actor, action: PurchaseAction, requestedBy: string) =>
  action === 'purchase_request.cancel'
    ? can(actor, 'purchase.cancel', { requestedBy })
    : can(actor, 'purchase.approve')

// 허용이면 null, 막으면 그 쓰기가 내는 첫 코드. 권한(403) → 완료한 행사 → 요청 상태 순서다.
// 취소는 요청한 사람만이고 결재가 시작되면 닫힌다. 승인(결재)은 재정부가 대기 품목이 남은 요청에서 한다.
// 결재에서 고른 예산 항목의 행사는 품목마다 다른 값이라 여기 없고 쓰기가 따로 잠그고 본다.
export function decide(
  actor: Actor,
  facts: RequestFacts,
  action: PurchaseAction,
): ErrorCode | null {
  if (!roleAllows(actor, action, facts.requestedBy)) return 'FORBIDDEN'
  if (facts.eventCompleted) return 'EVENT_COMPLETED'
  if (facts.requestCancelled) return 'REQUEST_CLOSED'
  if (action === 'purchase_request.cancel') return facts.decided ? 'REQUEST_CLOSED' : null
  return facts.status === 'pending' ? null : 'LINE_ITEM_DECIDED'
}

export const actionsOf = (actor: Actor, facts: RequestFacts): PurchaseAction[] =>
  PURCHASE_ACTIONS.filter(action => decide(actor, facts, action) === null)

// 품목 하나의 판정에 드는 사실(DEC-73). 취소는 마지막 결과가 승인이고 결제하지 않은 품목만이다.
export type LineItemFacts = {
  status: LineItemStatus
  // 취소하지 않은 결제 내역이 있다.
  paid: boolean
  requestCancelled: boolean
  // 요청의 행사, 품목 예산 항목의 행사가 각각 완료됐다. 둘 중 하나만 완료해도 막는 것은 decideLineItem이다.
  requestEventCompleted: boolean
  budgetEventCompleted: boolean
}

// 품목 한 줄에서 읽은 값과 완료한 행사 집합으로 판정에 드는 사실을 만든다. 읽기(actions)와 쓰기(취소)가 같이 쓴다.
export function lineItemFactsOf(
  read: {
    outcome: string | null
    paid: boolean
    requestCancelled: boolean
    requestEventId: string | null
    budgetEventId: string | null
  },
  completed: ReadonlySet<string>,
): LineItemFacts {
  const isCompleted = (id: string | null) => id !== null && completed.has(id)
  return {
    status: lineItemStatusOf(read.outcome),
    paid: read.paid,
    requestCancelled: read.requestCancelled,
    requestEventCompleted: isCompleted(read.requestEventId),
    budgetEventCompleted: isCompleted(read.budgetEventId),
  }
}

// 허용이면 null. 권한(403) → 완료한 행사 → 품목 상태 순서다. 기간 잠금은 보지 않는다: 돈이 움직이지 않는다.
// 지출을 취소해 결제가 없어지면 다시 취소할 수 있다.
export function decideLineItem(
  actor: Actor,
  facts: LineItemFacts,
  action: LineItemAction,
): ErrorCode | null {
  if (!can(actor, 'purchase.approve')) return 'FORBIDDEN'
  if (facts.requestEventCompleted || facts.budgetEventCompleted) return 'EVENT_COMPLETED'
  const open = facts.status === 'approved' && !facts.paid && !facts.requestCancelled
  return action === 'line_item.cancel' && open ? null : 'LINE_ITEM_NOT_CANCELLABLE'
}

export const lineItemActionsOf = (actor: Actor, facts: LineItemFacts): LineItemAction[] =>
  LINE_ITEM_ACTIONS.filter(action => decideLineItem(actor, facts, action) === null)
