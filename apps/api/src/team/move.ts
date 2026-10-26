import type { MoveDepartmentRequest } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { ApiError } from '../http/errors.js'
import type { Tx } from '../db/types.js'
import {
  assignDepartment,
  currentMembership,
  departmentOf,
  placementOf,
  removeFromDepartment,
} from './service.js'

// 부서 옮기기(DEC-91, 기능 023 정한 것 4): 옛 부서 소속을 끝내고 새 부서 소속을 연다. 학생회 행을 잠근 같은 거래에서 부르므로
// 중간에 실패하면 둘 다 되돌아가 두 부서에 남거나 어디에도 없는 일이 없다. 옛 부서의 직급은 따라가지 않고 rank로 새로 정한다.
// 모두 미리 확인한 뒤에 쓴다: 옛 소속 없음 404, 새 부서 없음(다른 학생회 포함) 404, 이미 든 부서 409, 직급이 걸리면 직급 칸 403.
export async function moveDepartment(
  tx: Tx,
  actor: Actor,
  memberId: string,
  { fromDepartmentId, toDepartmentId, rank }: MoveDepartmentRequest,
) {
  await currentMembership(tx, actor, memberId)
  const [from] = await placementOf(tx, actor, memberId, fromDepartmentId)
  if (!from || from.endsAt !== null) throw new ApiError('NOT_FOUND')
  await departmentOf(tx, actor, toDepartmentId)
  const [to] = await placementOf(tx, actor, memberId, toDepartmentId)
  if (to && to.endsAt === null) throw new ApiError('ALREADY_IN_DEPARTMENT')
  // 직급이 붙은 소속을 끝내거나 새 직급을 주는 것은 직급 칸이다(최소 권한, DEC-28).
  if ((from.rank !== null || rank !== null) && !can(actor, 'rank.manage'))
    throw new ApiError('FORBIDDEN')
  await removeFromDepartment(tx, actor, memberId, fromDepartmentId)
  await assignDepartment(tx, actor, { memberId, departmentId: toDepartmentId, rank })
}
