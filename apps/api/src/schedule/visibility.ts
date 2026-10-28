import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { isLeadership } from '../access/permissions.js'
import { record, scheduleItem } from '../db/schema.js'

// 집계·상세·홈은 같은 범위를 읽는다. 만든 사람도 부서를 떠나면 부서 공개를 볼 수 없다(DEC-102).
export function visibleScheduleWhere(actor: Actor) {
  const departments = actor.departments.map(item => item.departmentId)
  return and(
    eq(record.councilId, actor.councilId),
    eq(scheduleItem.councilId, actor.councilId),
    isNull(scheduleItem.cancelledAt),
    isLeadership(actor)
      ? undefined
      : or(
          eq(scheduleItem.visibility, 'council'),
          departments.length ? inArray(scheduleItem.departmentId, departments) : undefined,
        ),
  )
}
