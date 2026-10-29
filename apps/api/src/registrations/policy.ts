import {
  APPLICANT_ACTIONS,
  FORM_ACTIONS,
  type Action,
  type ApplicantAction,
  type ErrorCode,
  type FormAction,
  type FormListAction,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can, type Context } from '../access/permissions.js'
import type { Db, Tx } from '../db/types.js'
import { activeDepositOf } from '../deposits/queries.js'
import { refundPendingFacts } from '../deposits/refund-pending.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong, lockEventsShared } from '../policy/locks.js'
import { attendanceResultOf } from './my-registration.js'
import { registrationContextOf } from './permission-context.js'
import { isFormClosed } from './state.js'

type Reader = Pick<Db, 'select'>

// 신청 양식과 신청자 정책(기능 012): 화면에 주는 동작(actions)과 서버의 거절이 같은 decide에서 나온다.
// 읽기는 factsOf(또는 이미 읽은 값으로 factsFrom) → actionsOf, 쓰기는 행사 행 잠금을 잡은 뒤 같은 거래에서 factsOf → decide → 던짐이다.
// 규칙의 원문은 logical-model RULE-11(완료한 행사는 바꾸지 않는다), RULE-43(마감·완료한 양식은 멈추거나 다시 받지 않고
// 신청자 명단은 완료 뒤에도 본다), RULE-27, '참가 신청의 환불 대기'(DEC-55, 환불함은 재정부만, DEC-66·67)다.

type EventAction = 'form.create' | 'form.update' | 'form.check_in' | 'form.view_applicants'
type FormStateAction = 'form.pause' | 'form.resume' | 'form.activate'
type FormPolicyAction = FormAction | FormListAction

// 행사 단위 사실. 양식이 없는 동작(만들기, QR 출석)과 양식 상태를 보지 않는 동작은 이것만으로 판정한다.
// 읽지 않은 사실은 막는 쪽 값이어야 하므로 모든 칸을 부르는 쪽이 채운다(맥락이 없으면 거부).
export type EventFacts = {
  // 그 행사의 책임자와 담당 부서(권한 맥락)
  context: Context
  eventCompleted: boolean
}

// 양식 하나의 사실: 마감과 멈춤을 더한다.
export type FormFacts = EventFacts & {
  // 마감 시각이 지났는가
  closed: boolean
  paused: boolean
}

const APPLICANT_PERMISSION: Record<ApplicantAction, Action> = {
  'registration.check_in': 'registration.manage',
  'registration.mark_absent': 'registration.manage',
  'registration.cancel_check_in': 'registration.manage',
  'registration.cancel': 'registration.manage',
  'deposit.confirm': 'deposit.confirm',
  'deposit.cancel': 'deposit.confirm',
  // 환불함은 돈을 다루므로 재정부만 한다.
  'deposit.refund': 'finance.manage',
}

// 동작 → 권한 키. 상태 조건은 decide가 붙인다.
const PERMISSION: Record<FormPolicyAction, Action> = {
  'form.create': 'registration.manage',
  'form.update': 'registration.manage',
  'form.pause': 'registration.manage',
  'form.resume': 'registration.manage',
  'form.activate': 'registration.manage',
  // QR 출석은 신청자 한 줄의 출석과 같은 권한이다(규칙이 한 곳에만 있게).
  'form.check_in': APPLICANT_PERMISSION['registration.check_in'],
  'form.view_applicants': 'registration.view_applicants',
}

// 행사 단위 판정. 허용이면 null, 막으면 그 쓰기가 내는 첫 코드다. 권한(403) → 상태(409) 순서다.
export function decideOnEvent(
  actor: Actor,
  facts: EventFacts,
  action: EventAction | FormStateAction,
): ErrorCode | null {
  if (!can(actor, PERMISSION[action], facts.context)) return 'FORBIDDEN'
  // 신청자 보기는 읽기라 완료한 행사에도 남는다(열람 기록은 목록이 남긴다, RULE-22).
  if (action === 'form.view_applicants') return null
  return facts.eventCompleted ? 'EVENT_COMPLETED' : null
}

// 양식 하나의 판정. 마감 지난 양식은 멈추거나 다시 받지 않는다(RULE-43). 고치기(마감 늘리기)와 출석은 마감 뒤에도 된다.
function decide(actor: Actor, facts: FormFacts, action: FormPolicyAction): ErrorCode | null {
  const code = decideOnEvent(actor, facts, action)
  if (code) return code
  return (action === 'form.pause' || action === 'form.resume' || action === 'form.activate') &&
    facts.closed
    ? 'FORM_CLOSED'
    : null
}

// 이미 읽은 값으로 사실을 만든다(목록은 행사마다 한 번 읽어 여러 양식에 나눠 준다).
export const factsFrom = (
  read: {
    context: Context
    eventCompleted: boolean
    closesAt: Date | null
    pausedAt: Date | null
  },
  now: Date,
): FormFacts => ({
  context: read.context,
  eventCompleted: read.eventCompleted,
  closed: isFormClosed(read.closesAt, now),
  paused: read.pausedAt !== null,
})

type EventRow = { eventId: string; eventOwnerId: string | null }

// 행사 단위 사실을 한 번 읽는다. 쓰기는 행사 행 잠금을 잡은 뒤 같은 거래에서 부른다. 읽기는 잠그지 않는다.
export async function eventFactsOf(db: Reader, actor: Actor, row: EventRow): Promise<EventFacts> {
  const context = await registrationContextOf(db, actor, {
    id: row.eventId,
    ownerId: row.eventOwnerId,
  })
  const eventCompleted = (await completedEventIdsAmong(db, [row.eventId])).has(row.eventId)
  return { context, eventCompleted }
}

type FactsRow = EventRow & { closesAt: Date | null; pausedAt: Date | null }

// 양식 하나의 사실(읽기와 쓰기가 같이 쓴다).
async function factsOf(db: Reader, actor: Actor, row: FactsRow, now: Date) {
  return factsFrom({ ...(await eventFactsOf(db, actor, row)), ...row }, now)
}

// 화면에 줄 양식 동작: decide가 허용하는 것. 이미 그 상태인 멈추기·다시 받기는 쓰기가 조용히 넘어가지만 버튼으로는 주지 않는다.
export const actionsOf = (actor: Actor, facts: FormFacts): FormAction[] =>
  FORM_ACTIONS.filter(action => {
    if (action === 'form.pause' && facts.paused) return false
    if (action === 'form.resume' && !facts.paused) return false
    if (action === 'form.activate' && !facts.paused) return false
    return decide(actor, facts, action) === null
  })

// 양식 목록(행사 하나)에 줄 동작. 양식이 없어도 만들기를 보일지 가른다.
export const listActionsOf = (actor: Actor, facts: EventFacts): FormListAction[] =>
  decideOnEvent(actor, facts, 'form.create') === null ? ['form.create'] : []

// 쓰기: 행사 행을 FOR SHARE로 잠근 뒤(완료와 겹치면 하나로 정해진다) 사실을 읽고 판정해 던진다.
export async function assertEventAction(
  tx: Tx,
  actor: Actor,
  action: EventAction,
  target: EventRow,
): Promise<void> {
  await lockEventsShared(tx, [target.eventId])
  const code = decideOnEvent(actor, await eventFactsOf(tx, actor, target), action)
  if (code) throw new ApiError(code)
}

// 양식의 멈추기·다시 받기 쓰기. 마감은 주입 시계로 센다.
export async function assertFormAction(
  tx: Tx,
  actor: Actor,
  action: FormStateAction,
  target: FactsRow & { now: Date },
): Promise<void> {
  await lockEventsShared(tx, [target.eventId])
  const code = decide(actor, await factsOf(tx, actor, target, target.now), action)
  if (code) throw new ApiError(code)
}

// 신청자 한 줄의 사실. 읽기(목록)와 쓰기(출석, 취소, 입금, 환불)가 같은 모양으로 채운다.
export type ApplicantFacts = EventFacts & {
  // 취소하지 않았고 기한이 지나 비우지도 않았다
  live: boolean
  cancelledAt: Date | null
  // 적용 참가비가 없다. 참가비 없는 신청은 입금을 확인하지 않는다.
  free: boolean
  attended: boolean
  // 취소하지 않은 출석 기록의 결과가 불참이다(DEC-93)
  absent: boolean
  // 취소하지 않은 입금 기록
  deposit: { id: string; amount: number; refundedAt: Date | null } | null
}

// 살아 있는 신청에만 하는 동작. 취소했거나 비운 신청은 없는 것과 같아 404다.
const LIVE_ACTIONS = [
  'registration.check_in',
  'registration.mark_absent',
  'registration.cancel_check_in',
  'registration.cancel',
  'deposit.confirm',
] as const
export type LiveApplicantAction = (typeof LIVE_ACTIONS)[number]
const NEEDS_LIVE = new Set<ApplicantAction>(LIVE_ACTIONS)

export const mayApplicant = (actor: Actor, context: Context, action: ApplicantAction) =>
  can(actor, APPLICANT_PERMISSION[action], context)

// 권한과 완료와 살아 있음을 지나서 신청과 입금의 상태가 막는 첫 코드. 이미 출석한 신청의 출석은 조용히 already로 넘어간다.
const STATE_CODE: Record<ApplicantAction, (facts: ApplicantFacts) => ErrorCode | null> = {
  'registration.check_in': () => null,
  // 참석한 신청은 출석을 먼저 취소한다. 이미 불참이면 조용히 넘어간다.
  'registration.mark_absent': facts => (facts.attended ? 'CHECKED_IN' : null),
  // 출석 취소는 불참 기록도 되돌린다.
  'registration.cancel_check_in': facts =>
    facts.attended || facts.absent ? null : 'NOT_CHECKED_IN',
  'registration.cancel': facts => (facts.attended ? 'CHECKED_IN' : null),
  'deposit.confirm': facts => {
    if (facts.deposit) return 'DEPOSIT_EXISTS'
    // 금액이 1원 이상이어야 하는데 적용 참가비가 0이면 쓰기가 400을 내던 칸이다. 읽기도 같은 판정으로 숨긴다.
    return facts.free ? 'INVALID_INPUT' : null
  },
  'deposit.cancel': ({ deposit }) => {
    if (!deposit) return 'NO_DEPOSIT'
    return deposit.refundedAt ? 'DEPOSIT_CLOSED' : null
  },
  'deposit.refund': facts =>
    refundPendingFacts({
      registrationCancelledAt: facts.cancelledAt,
      hasDeposit: facts.deposit !== null,
      refundedAt: facts.deposit?.refundedAt ?? null,
    })
      ? null
      : 'NOT_REFUNDABLE',
}

// 신청자 동작의 판정. 권한(403) → 완료(409) → 신청이 살아 있는가(404) → 상태(409) 순서다.
export function decideApplicant(
  actor: Actor,
  facts: ApplicantFacts,
  action: ApplicantAction,
): ErrorCode | null {
  if (!mayApplicant(actor, facts.context, action)) return 'FORBIDDEN'
  if (facts.eventCompleted) return 'EVENT_COMPLETED'
  if (NEEDS_LIVE.has(action) && !facts.live) return 'NOT_FOUND'
  return STATE_CODE[action](facts)
}

// 화면에 줄 신청자 동작. 출석한 신청은 [출석]을 주지 않는다(신청 취소는 CHECKED_IN으로 막혀 출석 취소만 남는다).
export const applicantActionsOf = (actor: Actor, facts: ApplicantFacts): ApplicantAction[] =>
  APPLICANT_ACTIONS.filter(action => {
    if (action === 'registration.check_in' && facts.attended) return false
    if (action === 'registration.mark_absent' && facts.absent) return false
    return decideApplicant(actor, facts, action) === null
  })

// 이미 읽은 행사 사실에 신청 한 줄의 값을 얹는다(목록은 줄마다 같은 행사 사실을 쓴다).
export const applicantFactsFrom = (
  event: EventFacts,
  row: Pick<ApplicantFacts, 'attended' | 'absent' | 'cancelledAt' | 'deposit'> & {
    name: string | null
    appliedFee: number | string
  },
): ApplicantFacts => ({
  ...event,
  live: row.cancelledAt === null && row.name !== null,
  cancelledAt: row.cancelledAt,
  free: Number(row.appliedFee) <= 0,
  attended: row.attended,
  absent: row.absent,
  deposit: row.deposit,
})

// 출석 기록의 결과 하나를 참석·불참 두 사실로 나눈다. 목록(줄마다 읽은 결과)과 쓰기가 같이 쓴다.
export const attendanceFactsFrom = (result: string | null) => ({
  attended: result === 'attended',
  absent: result === 'absent',
})

const attendanceFactsOf = async (db: Reader, registrationId: string) =>
  attendanceFactsFrom(await attendanceResultOf(db, registrationId))

// 쓰기의 사실: 신청 행을 잠근 뒤 같은 거래에서 읽는다.
export async function applicantFactsOf(
  db: Reader,
  actor: Actor,
  row: {
    id: string
    eventId: string
    ownerId: string | null
    name: string | null
    appliedFee: string
    cancelledAt: Date | null
  },
) {
  return applicantFactsFrom(
    await eventFactsOf(db, actor, { eventId: row.eventId, eventOwnerId: row.ownerId }),
    {
      name: row.name,
      appliedFee: row.appliedFee,
      cancelledAt: row.cancelledAt,
      ...(await attendanceFactsOf(db, row.id)),
      deposit: await activeDepositOf(db, row.id),
    },
  )
}
