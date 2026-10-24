import {
  FORM_ACTIONS,
  type Action,
  type ErrorCode,
  type FormAction,
  type FormListAction,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can, type Context } from '../access/permissions.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong, lockEventsShared } from '../policy/locks.js'
import { registrationContextOf } from './permission-context.js'
import { isFormClosed } from './state.js'

type Reader = Pick<Db, 'select'>

// 신청 양식 정책(기능 012): 화면에 주는 동작(actions)과 서버의 거절이 같은 decide에서 나온다.
// 읽기는 factsOf(또는 이미 읽은 값으로 factsFrom) → actionsOf, 쓰기는 행사 행 잠금을 잡은 뒤 같은 거래에서 factsOf → decide → 던짐이다.
// 규칙의 원문은 logical-model RULE-11(완료한 행사는 바꾸지 않는다: 신청자 보기는 읽기라 남는다)과 RULE-27(양식 상태)이다.

type FormPolicyAction = FormAction | FormListAction

// 판정에 드는 사실. 읽지 않은 사실은 막는 쪽 값이어야 하므로 모든 칸을 부르는 쪽이 채운다(맥락이 없으면 거부).
export type FormFacts = {
  // 그 행사의 책임자와 담당 부서(권한 맥락)
  context: Context
  eventCompleted: boolean
  // 마감 시각이 지났는가(양식이 아직 없는 만들기는 거짓)
  closed: boolean
  paused: boolean
}

// 동작 → 권한 키. 상태 조건은 decide가 붙인다.
const PERMISSION: Record<FormPolicyAction, Action> = {
  'form.create': 'registration.manage',
  'form.update': 'registration.manage',
  'form.pause': 'registration.manage',
  'form.resume': 'registration.manage',
  'form.check_in': 'registration.manage',
  'form.view_applicants': 'registration.view_applicants',
  'deposit.confirm': 'deposit.confirm',
}

// 허용이면 null, 막으면 그 쓰기가 내는 첫 코드. 권한(403) → 상태(409) 순서다.
export function decide(actor: Actor, facts: FormFacts, action: FormPolicyAction): ErrorCode | null {
  if (!can(actor, PERMISSION[action], facts.context)) return 'FORBIDDEN'
  // 신청자 보기는 읽기라 완료한 행사에도 남는다(열람 기록은 목록이 남긴다, RULE-22).
  if (action === 'form.view_applicants') return null
  if (facts.eventCompleted) return 'EVENT_COMPLETED'
  // 마감 지난 양식은 멈추거나 다시 받지 않는다. 고치기(마감 늘리기)와 출석은 마감 뒤에도 된다.
  if ((action === 'form.pause' || action === 'form.resume') && facts.closed) return 'FORM_CLOSED'
  return null
}

// 이미 읽은 값으로 사실을 만든다(목록은 행사마다 한 번 읽어 여러 양식에 나눠 준다).
export const factsFrom = (
  read: { context: Context; eventCompleted: boolean; closesAt: Date | null; pausedAt: Date | null },
  now: Date,
): FormFacts => ({
  context: read.context,
  eventCompleted: read.eventCompleted,
  closed: read.closesAt !== null && isFormClosed(read.closesAt, now),
  paused: read.pausedAt !== null,
})

type FactsRow = {
  eventId: string
  eventOwnerId: string | null
  closesAt: Date | null
  pausedAt: Date | null
}

// 사실을 한 번 읽는다. 쓰기는 행사 행 잠금을 잡은 뒤 같은 거래에서 부른다. 읽기는 잠그지 않는다.
export async function factsOf(db: Reader, actor: Actor, row: FactsRow, now: Date) {
  const context = await registrationContextOf(db, actor, {
    id: row.eventId,
    ownerId: row.eventOwnerId,
  })
  const eventCompleted = (await completedEventIdsAmong(db, [row.eventId])).has(row.eventId)
  return factsFrom({ context, eventCompleted, ...row }, now)
}

// 화면에 줄 양식 동작: decide가 허용하는 것. 이미 그 상태인 멈추기·다시 받기는 쓰기가 조용히 넘어가지만 버튼으로는 주지 않는다.
export const actionsOf = (actor: Actor, facts: FormFacts): FormAction[] =>
  FORM_ACTIONS.filter(action => {
    if (action === 'form.pause' && facts.paused) return false
    if (action === 'form.resume' && !facts.paused) return false
    return decide(actor, facts, action) === null
  })

// 양식 목록(행사 하나)에 줄 동작. 양식이 없어도 만들기를 보일지 가른다.
export const listActionsOf = (actor: Actor, facts: FormFacts): FormListAction[] =>
  decide(actor, facts, 'form.create') === null ? ['form.create'] : []

// 쓰기: 행사 행을 FOR SHARE로 잠근 뒤(완료와 겹치면 하나로 정해진다) 사실을 읽고 판정해 던진다.
export async function assertFormAction(
  tx: Tx,
  actor: Actor,
  action: FormPolicyAction,
  target: FactsRow & { now: Date },
): Promise<void> {
  await lockEventsShared(tx, [target.eventId])
  const code = decide(actor, await factsOf(tx, actor, target, target.now), action)
  if (code) throw new ApiError(code)
}
