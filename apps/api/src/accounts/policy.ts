import { ACCOUNT_ACTIONS, type AccountAction, type ErrorCode } from '@vada/contracts'
import { and, eq, inArray } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { record, registrationForm } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong, lockEventsShared } from '../policy/locks.js'

type Reader = Pick<Db, 'select'>

// 계좌 정책(기능 014, 012의 꼴): 화면에 주는 동작(actions)과 서버의 거절이 같은 decide에서 나온다.
// 읽기는 factsOf → actionsOf, 쓰기는 같은 거래에서 factsOf → decide → 던짐(assertAllowed)이다.
// 규칙의 원문은 logical-model RULE-34다: 완료하지 않은 행사의 신청 양식이 참가비 받는 계좌로 가리키는 계좌는 닫지 않는다.

// 판정에 드는 사실. formsInUse가 null이면 읽지 않은 것이라 닫기를 막는다: 읽지 않은 사실로 판정하면 허용이 아니라 거절이 나온다.
export type AccountFacts = {
  closed: boolean
  formsInUse: number | null
}

// 계좌의 모든 동작은 재정부만이다(회장단도 아니다).
const roleAllows = (actor: Actor) => can(actor, 'finance.manage')

// 허용이면 null, 막으면 그 쓰기가 내는 첫 코드. 권한(403) → 닫은 계좌 → (닫기만) 쓰는 중인 양식 순서다.
export function decide(actor: Actor, facts: AccountFacts, action: AccountAction): ErrorCode | null {
  if (!roleAllows(actor)) return 'FORBIDDEN'
  if (facts.closed) return 'ACCOUNT_CLOSED'
  if (action === 'account.close' && (facts.formsInUse === null || facts.formsInUse > 0))
    return 'ACCOUNT_IN_USE'
  return null
}

// 계좌마다 완료하지 않은 행사의 신청 양식 수. 양식은 학생회 기록에서 이 학생회 것만 센다.
// lock에 거래를 주면 행사 행을 FOR SHARE로 잠근 뒤 읽는다(행사 완료와 겹치면 하나로 정해진다).
async function formsInUseOf(
  db: Reader,
  actor: Actor,
  accountIds: readonly string[],
  lock?: Tx,
): Promise<Map<string, number>> {
  const counts = new Map(accountIds.map(id => [id, 0]))
  if (!accountIds.length) return counts
  const forms = await db
    .select({ accountId: registrationForm.feeAccountId, eventId: registrationForm.eventId })
    .from(registrationForm)
    .innerJoin(record, eq(record.id, registrationForm.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        inArray(registrationForm.feeAccountId, [...accountIds]),
      ),
    )
  const events = [...new Set(forms.map(form => form.eventId))]
  if (lock) await lockEventsShared(lock, events)
  const completed = await completedEventIdsAmong(db, events)
  for (const form of forms)
    if (form.accountId && !completed.has(form.eventId))
      counts.set(form.accountId, (counts.get(form.accountId) ?? 0) + 1)
  return counts
}

// 사실을 읽는다. 닫기를 판정하지 않으면(actions에 없으면) 양식은 읽지 않는다.
export async function factsOf(
  db: Reader,
  actor: Actor,
  rows: readonly { id: string; closedOn: string | null }[],
  scope: { lock?: Tx; actions?: readonly AccountAction[] } = {},
): Promise<Map<string, AccountFacts>> {
  const { lock, actions = ACCOUNT_ACTIONS } = scope
  const counts = actions.includes('account.close')
    ? await formsInUseOf(
        db,
        actor,
        rows.map(row => row.id),
        lock,
      )
    : null
  return new Map(
    rows.map(row => [
      row.id,
      { closed: row.closedOn !== null, formsInUse: counts?.get(row.id) ?? null },
    ]),
  )
}

// 화면에 줄 동작: decide가 허용하는 것
export const actionsOf = (actor: Actor, facts: AccountFacts): AccountAction[] =>
  ACCOUNT_ACTIONS.filter(action => decide(actor, facts, action) === null)

// 쓰기: 같은 거래에서 부른다. 같은 decide가 막으면 그 코드를 던진다. 403은 decide의 첫 순서다.
export async function assertAllowed(
  tx: Tx,
  actor: Actor,
  row: { id: string; closedOn: string | null },
  action: AccountAction,
) {
  const facts = (await factsOf(tx, actor, [row], { lock: tx, actions: [action] })).get(row.id)
  const code = facts && decide(actor, facts, action)
  if (code) throw new ApiError(code)
}
