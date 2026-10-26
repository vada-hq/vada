import { and, eq, isNull } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { departmentMembership } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, updateRecords, type AnyRecordChange } from '../records/records.js'
import { departmentOf } from './service.js'

// 쓴 부서 그만 쓰기(DEC-91, 기능 023 정한 것 8): 그만 쓴 시각을 적고, 남은 열린 소속을 같은 거래에서 끝낸다.
// 방 참여는 부르는 길(편성 거래)이 맞춘다. 기록과 근거 연결은 그대로 두고, 되돌리지 않는다(다시 쓰기는 두지 않음).
// 재정 역할이 있는 부서는 그만 쓰지 못한다. 재정 역할 부서는 늘 있어야 해서(DEC-87) 먼저 역할을 거둔다.
export async function retireDepartment(tx: Tx, actor: Actor, departmentId: string) {
  const current = await departmentOf(tx, actor, departmentId)
  if (current.role !== null) throw new ApiError('DEPARTMENT_HAS_ROLE')
  const open = await tx
    .select({ id: departmentMembership.id })
    .from(departmentMembership)
    .where(
      and(eq(departmentMembership.departmentId, departmentId), isNull(departmentMembership.endsAt)),
    )
  const changes: AnyRecordChange[] = [
    ...open.map(item => ({
      kind: 'department_membership' as const,
      id: item.id,
      actor: actor.memberId,
      reason: null,
      changes: { endsAt: clockNow },
    })),
    {
      kind: 'department',
      id: departmentId,
      actor: actor.memberId,
      reason: null,
      changes: { retiredAt: clockNow },
    },
  ]
  await updateRecords(tx, changes)
}
