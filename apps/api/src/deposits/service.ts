import type { ApplicantDeposit } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { clearVersionValues } from '../registrations/personal-values.js'
import { lockedLiveRegistration, lockedRegistration } from '../registrations/staff-registration.js'

const MIN_WON = 1

// 환불 대기가 끝나면(입금 확인 취소, 환불함) 남겨 둔 이름·휴대폰 번호를 지금 값과 모든 판에서 비운다(DEC-55). 되돌릴 수 없다.
async function clearApplicant(tx: Tx, actor: Actor, registrationId: string) {
  await updateRecord(tx, {
    kind: 'registration',
    id: registrationId,
    actor: actor.memberId,
    reason: null,
    changes: { name: null, phone: null },
  })
  await clearVersionValues(tx, [registrationId])
}

// 입금 확인. 금액을 빼면 신청의 적용 참가비다. 신청 행 잠금 뒤에 다시 읽어 동시에 둘이 확인해도 하나만 된다(부분 유일 인덱스는 마지막 방어선).
export async function confirmDeposit(
  tx: Tx,
  actor: Actor,
  registrationId: string,
  input: { amount: number | null },
): Promise<ApplicantDeposit> {
  const row = await lockedLiveRegistration(tx, actor, registrationId, 'deposit.confirm')
  const amount = input.amount ?? Number(row.appliedFee)
  if (amount < MIN_WON) throw new ApiError('INVALID_INPUT')
  await createRecord(tx, {
    kind: 'deposit',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { registrationId: row.id, amount: String(amount), confirmedAt: clockNow },
  })
  return { status: 'confirmed', amount }
}

// 입금 확인 취소. 환불 대기 신청이면 남겨 둘 이유가 없어져 같은 거래에서 이름·휴대폰 번호도 비운다.
export async function cancelDeposit(
  tx: Tx,
  actor: Actor,
  registrationId: string,
  input: { reason: string },
): Promise<ApplicantDeposit> {
  const row = await lockedRegistration(tx, actor, registrationId, 'deposit.cancel')
  // 환불 전 입금이 있음은 정책이 보장했다.
  const active = row.deposit!
  await updateRecord(tx, {
    kind: 'deposit',
    id: active.id,
    actor: actor.memberId,
    reason: input.reason,
    changes: { cancelledAt: clockNow },
  })
  if (row.cancelledAt) await clearApplicant(tx, actor, row.id)
  return { status: 'none', amount: null }
}

// 환불함 표시. 환불 대기(취소한 신청에 환불 전 입금)에만, 한 번. 이름·휴대폰 번호를 같은 거래에서 비운다.
export async function refundDeposit(
  tx: Tx,
  actor: Actor,
  registrationId: string,
  input: { amount: number | null },
): Promise<ApplicantDeposit> {
  const row = await lockedRegistration(tx, actor, registrationId, 'deposit.refund')
  // 환불 대기(취소한 신청에 환불 전 입금)임은 정책이 보장했다.
  const active = row.deposit!
  const amount = input.amount ?? active.amount
  if (amount < MIN_WON || amount > active.amount) throw new ApiError('INVALID_INPUT')
  await updateRecord(tx, {
    kind: 'deposit',
    id: active.id,
    actor: actor.memberId,
    reason: null,
    changes: { refundedAt: clockNow, refundAmount: String(amount) },
  })
  await clearApplicant(tx, actor, row.id)
  return { status: 'refunded', amount: active.amount }
}
