import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { department, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<Db, 'select'>

// 기록이 고른 부서는 이 학생회의 부서여야 한다. 외래 키는 학생회까지 맞추지 못한다.
// 다른 학생회의 부서와 없는 부서는 같은 409 DEPARTMENT_INVALID라 다른 학생회 부서가 있는지 드러나지 않는다.
export async function assertCouncilDepartment(
  db: Reader,
  actor: Actor,
  departmentId: string | null | undefined,
): Promise<void> {
  if (!departmentId) return
  const [found] = await db
    .select({ id: department.id })
    .from(department)
    .innerJoin(record, eq(record.id, department.id))
    .where(and(eq(department.id, departmentId), eq(record.councilId, actor.councilId)))
  if (!found) throw new ApiError('DEPARTMENT_INVALID')
}
