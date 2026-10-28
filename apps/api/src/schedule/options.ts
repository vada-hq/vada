import { asc, eq } from 'drizzle-orm'
import type { ScheduleOptionsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { department } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { departmentChoosable } from './policy.js'

// 일정 창의 부서 선택지. 화면이 직급으로 고르지 않게 쓰기 거절과 같은 판정으로 서버가 고른다.
export async function scheduleOptionsOf(tx: Tx, actor: Actor): Promise<ScheduleOptionsResponse> {
  const rows = await tx
    .select({ id: department.id, name: department.name })
    .from(department)
    .where(eq(department.councilId, actor.councilId))
    .orderBy(asc(department.id))
  return { departments: rows.filter(row => departmentChoosable(actor, row.id)) }
}
