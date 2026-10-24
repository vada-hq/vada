import {
  EVIDENCE_MAX,
  EXPENSE_ACTIONS,
  koreanDateOf,
  type ErrorCode,
  type ExpenseAction,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import {
  completedEventIdsAmong,
  isDayClosed,
  lockCodeOf,
  lockedCompleted,
} from '../policy/locks.js'
import { eventsOfExpense } from './event-lock.js'

type Reader = Pick<Db, 'select'>

// 지출 정책(기능 014, 012의 꼴): 화면에 주는 동작(actions)과 서버의 거절이 같은 decide에서 나온다.
// 읽기는 factsOf → actionsOf, 쓰기는 지출 행 잠금을 잡은 뒤 같은 거래에서 factsOf → decide → 던짐(assertAllowed)이다.
// 규칙의 원문은 logical-model RULE-10(지출 취소는 되돌리지 않음), RULE-11(완료한 행사의 증빙·지출 잠금), RULE-12, RULE-36(공개한 기간은 취소만 막는다)이다.

// 판정에 드는 사실. 동작 하나가 보지 않는 사실은 읽지 않아 막는 쪽 기본값이다: 읽지 않은 사실로 판정하면 허용이 아니라 거절이 나온다.
export type ExpenseFacts = {
  cancelled: boolean
  paidBy: string | null
  reimbursed: boolean
  evidenceCount: number
  // 지출의 어느 행사(적은 행사, 고른 예산 항목의 행사, 결제한 품목의 행사)든 완료했는가
  eventCompleted: boolean
  // 결제일이 든 회계 기간을 공개했는가(취소만 본다)
  periodClosed: boolean
}

type FactsRow = {
  id: string
  paidAt: Date
  cancelledAt: Date | null
  paidById: string | null
  reimbursedAt: Date | null
  evidenceCount: number
}

// 지출의 모든 동작은 재정부만이다(회장단도 아니다).
const roleAllows = (actor: Actor) => can(actor, 'finance.manage')

// 지출 자체의 상태가 막는 코드. 환급은 취소·먼저 낸 사람 없음·이미 환급이 한 코드(NOT_REIMBURSABLE)다.
function stateCodeOf(facts: ExpenseFacts, action: ExpenseAction): ErrorCode | null {
  if (action === 'expense.reimburse')
    return facts.cancelled || facts.paidBy === null || facts.reimbursed ? 'NOT_REIMBURSABLE' : null
  if (facts.cancelled) return 'EXPENSE_CANCELLED'
  const full = action === 'expense.attach_evidence' && facts.evidenceCount >= EVIDENCE_MAX
  return full ? 'EVIDENCE_LIMIT' : null
}

// 허용이면 null, 막으면 그 쓰기가 내는 첫 코드. 권한(403) → 완료한 행사 → (취소만) 공개한 기간 → 지출 상태 순서다.
function decide(actor: Actor, facts: ExpenseFacts, action: ExpenseAction): ErrorCode | null {
  if (!roleAllows(actor)) return 'FORBIDDEN'
  const locked = lockCodeOf({
    eventCompleted: facts.eventCompleted,
    periodClosed: action === 'expense.cancel' && facts.periodClosed,
  })
  if (locked) return locked
  return stateCodeOf(facts, action)
}

// 사실을 한 번 읽는다. 쓰기는 lock에 거래를 주어 행사 행을 FOR SHARE로 잠근 뒤 읽는다(완료와 겹치면 하나로 정해진다).
// actions는 이 동작들만 판정할 때 필요한 사실만 읽는다. 재정부가 아니면 읽지 않는다(어차피 403이다).
// extraEvents는 지출이 옮겨 갈 행사처럼 지금 값에는 없지만 완료 전이어야 하는 행사다.
export async function factsOf(
  db: Reader,
  actor: Actor,
  row: FactsRow,
  scope: {
    lock?: Tx
    actions?: readonly ExpenseAction[]
    extraEvents?: readonly (string | null)[]
  } = {},
): Promise<ExpenseFacts> {
  const { lock, actions = EXPENSE_ACTIONS, extraEvents = [] } = scope
  const facts: ExpenseFacts = {
    cancelled: row.cancelledAt !== null,
    paidBy: row.paidById,
    reimbursed: row.reimbursedAt !== null,
    evidenceCount: row.evidenceCount,
    eventCompleted: true,
    periodClosed: true,
  }
  if (!roleAllows(actor)) return facts
  const events = [...(await eventsOfExpense(db, actor, row.id)), ...extraEvents]
  facts.eventCompleted = lock
    ? await lockedCompleted(lock, events)
    : (
        await completedEventIdsAmong(
          db,
          events.filter((id): id is string => !!id),
        )
      ).size > 0
  if (actions.includes('expense.cancel'))
    facts.periodClosed = await isDayClosed(db, actor, koreanDateOf(row.paidAt))
  return facts
}

// 화면에 줄 동작: decide가 허용하는 것
export const actionsOf = (actor: Actor, facts: ExpenseFacts): ExpenseAction[] =>
  EXPENSE_ACTIONS.filter(action => decide(actor, facts, action) === null)

// 쓰기: 지출 행을 잠근 뒤 부른다. 같은 decide가 막으면 그 코드를 던진다. 403은 호출하는 쪽이 잠금 전에 먼저 던진다.
export async function assertAllowed(
  tx: Tx,
  actor: Actor,
  row: FactsRow,
  ask: { action: ExpenseAction; extraEvents?: readonly (string | null)[] },
) {
  const { action, extraEvents = [] } = ask
  const facts = await factsOf(tx, actor, row, { lock: tx, actions: [action], extraEvents })
  const code = decide(actor, facts, action)
  if (code) throw new ApiError(code)
}
