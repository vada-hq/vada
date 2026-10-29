import {
  dateFromKorean,
  koreanOf,
  missingFormConditions,
  type FormActivationFailure,
  type CreateFormRequest,
  type RegistrationForm,
  type UpdateFormRequest,
} from '@vada/contracts'
import { eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { assertUsableAccount } from '../accounts/queries.js'
import { registration } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { eventRowOf } from '../events/queries.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { assertLinkableTask } from '../tasks/link.js'
import { clearPhones } from './personal-values.js'
import { assertEventAction, assertFormAction } from './policy.js'
import { insertQuestions, replaceQuestions } from './question-write.js'
import { freshPublicCode } from './public-code.js'
import { formDetailOf, formRowOf, type FormRow } from './queries.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 행사·양식 읽기 → 권한표 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 학생회 행 잠금이 같은 학생회의 쓰기를 한 번에 하나로 줄 세우므로, 잠금 뒤에 읽은 책임자와 계좌가 이 거래가 끝날 때까지 바뀌지 않는다.
// 403이 409보다 먼저다. 다른 학생회 행사와 양식은 없는 것과 같아 404다.

type FeeInput = Pick<CreateFormRequest, 'payerFee' | 'nonPayerFee' | 'feeAccountId'>

// 초안은 계좌를 나중에 고를 수 있다. 활성화·활성 양식 고치기는 참가비 계좌가 필수이며, 고른 계좌는 늘 같은 학생회의 열린 계좌여야 한다.
async function assertFeeAccount(tx: Tx, actor: Actor, input: FeeInput, draft = false) {
  if (input.feeAccountId) return assertUsableAccount(tx, actor, input.feeAccountId)
  if (!draft && Math.max(input.payerFee ?? 0, input.nonPayerFee ?? 0) > 0)
    throw new ApiError('FEE_ACCOUNT_REQUIRED')
}

const fromKorean = (value: string | null) => (value ? dateFromKorean(value) : null)
const feeText = (value: number | null) => (value === null ? null : String(value))
const feeOf = (value: string | null) => (value === null ? null : Number(value))
const koreanOrNull = (value: Date | null) => (value ? koreanOf(value) : null)

export async function createForm(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; now: Date },
  input: CreateFormRequest,
): Promise<RegistrationForm> {
  const eventRow = await eventRowOf(tx, actor, target.eventId)
  await assertEventAction(tx, actor, 'form.create', {
    eventId: eventRow.id,
    eventOwnerId: eventRow.ownerId,
  })
  await assertFeeAccount(tx, actor, input, true)
  // 업무를 이으면 양식과 연결 한 줄이 한 거래에서 생기고 업무가 끝남이 된다. 거절이면 아무것도 생기지 않는다.
  if (input.taskId) await assertLinkableTask(tx, actor, input.taskId, target.now)
  const id = await createRecord(tx, {
    kind: 'registration_form',
    councilId: actor.councilId,
    actor: actor.memberId,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    values: {
      eventId: eventRow.id,
      name: input.name,
      opensAt: fromKorean(input.opensAt),
      closesAt: fromKorean(input.closesAt),
      capacity: input.capacity,
      notice: input.notice,
      collectsPhone: input.collectsPhone,
      collectsStudentId: input.collectsStudentId,
      publicCode: await freshPublicCode(tx),
      pausedAt: clockNow,
      payerFee: feeText(input.payerFee),
      nonPayerFee: feeText(input.nonPayerFee),
      feeAccountId: input.feeAccountId,
    },
  })
  await insertQuestions(tx, id, input.questions)
  return formDetailOf(tx, actor, id, target.now)
}

// 마감 비우기는 신청을 한 번도 받지 않은 멈춘 양식(초안, DEC-93)만 된다. 받는 중이거나 신청 행이 하나라도 있으면
// 마감이 상태와 지우는 날을 정한다. 취소한 신청도 센다: 환불 대기는 이름·휴대폰이 남아 지우는 날이 있어야 한다(Codex 검토).
// 신청은 멈춘 양식에 들어오지 않고 같은 거래가 학생회 행을 잠갔으므로 센 뒤에 신청이 생기지 않는다.
async function assertClosesAtAllowed(tx: Tx, row: FormRow, input: UpdateFormRequest) {
  if (input.closesAt !== null || row.closesAt === null) return
  const [taken] = await tx
    .select({ id: registration.id })
    .from(registration)
    .where(eq(registration.formId, row.id))
    .limit(1)
  if (row.pausedAt === null || taken) throw new ApiError('CLOSES_AT_REQUIRED')
}

// 받는 칸. 학번 받기를 바꾸면 그 뒤의 신청부터 따른다(DEC-75).
function collectChangesOf(row: FormRow, input: UpdateFormRequest) {
  return {
    ...(input.collectsPhone !== row.collectsPhone ? { collectsPhone: input.collectsPhone } : {}),
    ...(input.collectsStudentId !== row.collectsStudentId
      ? { collectsStudentId: input.collectsStudentId }
      : {}),
  }
}

function changesOf(row: FormRow, input: UpdateFormRequest) {
  return {
    ...(input.name !== row.name ? { name: input.name } : {}),
    ...(koreanOrNull(row.opensAt) !== input.opensAt ? { opensAt: fromKorean(input.opensAt) } : {}),
    ...(koreanOrNull(row.closesAt) !== input.closesAt
      ? { closesAt: fromKorean(input.closesAt) }
      : {}),
    ...(input.capacity !== row.capacity ? { capacity: input.capacity } : {}),
    ...(input.notice !== row.notice ? { notice: input.notice } : {}),
    ...collectChangesOf(row, input),
    ...(input.payerFee !== feeOf(row.payerFee) ? { payerFee: feeText(input.payerFee) } : {}),
    ...(input.nonPayerFee !== feeOf(row.nonPayerFee)
      ? { nonPayerFee: feeText(input.nonPayerFee) }
      : {}),
    ...(input.feeAccountId !== row.feeAccountId ? { feeAccountId: input.feeAccountId } : {}),
  }
}

// 고치기. 칸을 모두 받아 그대로 바꾸고, 같은 값이면 판을 만들지 않는다. 질문은 판이 없다(question-write.ts).
// 휴대폰 받기를 끄면 이미 받은 번호를 지금 값과 판에서 비운다(받지 않는 칸의 값이 남지 않게).
// 학번 받기는 꺼도 이미 받은 학번을 비우지 않는다. 입금 대조와 같은 이름 가리기에 쓰고 보관 기간(DEC-55)대로 지운다(DEC-75).
export async function updateForm(
  tx: Tx,
  actor: Actor,
  target: { formId: string; now: Date },
  input: UpdateFormRequest,
): Promise<RegistrationForm> {
  const row = await formRowOf(tx, actor, target.formId)
  await assertEventAction(tx, actor, 'form.update', row)
  await assertFeeAccount(tx, actor, input, row.pausedAt !== null)
  await assertClosesAtAllowed(tx, row, input)
  // 질문은 다른 칸보다 먼저 본다. 신청이 있어 바꿀 수 없으면 409로 거래 전체가 되돌아간다.
  if (input.questions) await replaceQuestions(tx, row.id, input.questions)
  const changes = changesOf(row, input)
  if (Object.keys(changes).length)
    await updateRecord(tx, {
      kind: 'registration_form',
      id: row.id,
      actor: actor.memberId,
      reason: null,
      changes,
    })
  if (row.collectsPhone && !input.collectsPhone) await clearPhones(tx, row.id)
  return formDetailOf(tx, actor, row.id, target.now)
}

// 멈추기와 다시 받기. 이미 그 상태이면 판도 오류도 없다(멈춘 양식을 다시 멈춰도 그대로다). 마감 지난 양식은 409 FORM_CLOSED다.
export async function setPaused(
  tx: Tx,
  actor: Actor,
  target: { formId: string; now: Date; paused: boolean },
): Promise<RegistrationForm | FormActivationFailure> {
  if (!target.paused) return activateForm(tx, actor, target)
  const row = await formRowOf(tx, actor, target.formId)
  await assertFormAction(tx, actor, 'form.pause', {
    ...row,
    now: target.now,
  })
  if ((row.pausedAt !== null) !== target.paused)
    await updateRecord(tx, {
      kind: 'registration_form',
      id: row.id,
      actor: actor.memberId,
      reason: null,
      changes: { pausedAt: target.paused ? clockNow : null },
    })
  return formDetailOf(tx, actor, row.id, target.now)
}

async function activateForm(
  tx: Tx,
  actor: Actor,
  target: { formId: string; now: Date },
): Promise<RegistrationForm | FormActivationFailure> {
  const row = await formRowOf(tx, actor, target.formId)
  await assertFormAction(tx, actor, 'form.activate', { ...row, now: target.now })
  const fees = {
    payerFee: feeOf(row.payerFee),
    nonPayerFee: feeOf(row.nonPayerFee),
    feeAccountId: row.feeAccountId,
  }
  const missingConditions = missingFormConditions({
    ...fees,
    eventStartsAt: koreanOrNull(row.eventStartsAt),
    opensAt: koreanOrNull(row.opensAt),
    closesAt: koreanOrNull(row.closesAt),
  })
  if (missingConditions.length) return { error: 'FORM_NOT_READY', missingConditions }
  try {
    await assertFeeAccount(tx, actor, fees)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ACCOUNT_INVALID')
      return { error: 'FORM_NOT_READY', missingConditions: ['fee_account'] }
    throw error
  }
  if (row.pausedAt !== null)
    await updateRecord(tx, {
      kind: 'registration_form',
      id: row.id,
      actor: actor.memberId,
      reason: '링크 활성화',
      changes: { pausedAt: null },
    })
  return formDetailOf(tx, actor, row.id, target.now)
}
