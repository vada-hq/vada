import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { registrationContextOf } from '../registrations/permission-context.js'

type Target = { id: string; ownerId: string | null }

// 입금 확인과 확인 취소: 신청 관리와 같은 기준(책임자, 담당 부서, 회장단)이라 같은 맥락으로 묻는다.
export async function assertConfirm(db: Pick<Db, 'select'>, actor: Actor, target: Target) {
  const context = await registrationContextOf(db, actor, target)
  if (!can(actor, 'deposit.confirm', context)) throw new ApiError('FORBIDDEN')
}

// 환불함은 돈을 다루므로 재정부만 한다. 행사 맥락이 없다.
export function assertRefund(_db: Pick<Db, 'select'>, actor: Actor, _target: Target) {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  return Promise.resolve()
}
