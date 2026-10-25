import { and, asc, eq, inArray } from 'drizzle-orm'
import type { HomeDepartment } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { department } from '../db/schema.js'
import type { Db } from '../db/types.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { listOf } from './open-tasks.js'

type Reader = Pick<Db, 'select'>

// 부서 직급이 있는 부서마다의 진행. 학생회 번호로도 거른다(다른 학생회 부서가 섞이지 않게).
export async function departmentsOf(
  db: Reader,
  actor: Actor,
  departmentIds: string[],
  open: OpenTask[],
): Promise<HomeDepartment[]> {
  if (!departmentIds.length) return []
  const rows = await db
    .select({ id: department.id, name: department.name })
    .from(department)
    .where(and(eq(department.councilId, actor.councilId), inArray(department.id, departmentIds)))
    .orderBy(asc(department.id))
  // 부서 이름 차례는 council의 부서별 막힌 곳과 같게 JS 한 곳에서 맞춘다.
  return rows
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(row => {
      const mine = open.filter(item => item.summary.department?.id === row.id)
      const overdue = mine.filter(item => item.summary.overdue)
      const unassigned = mine.filter(item => item.unassigned)
      return {
        id: row.id,
        name: row.name,
        counts: {
          todo: mine.filter(item => item.summary.status === 'todo').length,
          inProgress: mine.filter(item => item.summary.status === 'in_progress').length,
          overdue: overdue.length,
          unassigned: unassigned.length,
        },
        overdue: listOf(overdue),
        unassigned: listOf(unassigned),
      }
    })
}
