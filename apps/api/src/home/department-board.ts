import type { HomeDepartmentBoard } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { headDepartmentIds } from '../access/permissions.js'
import type { Db } from '../db/types.js'
import { openEventsAmong } from '../events/queries.js'
import { withSettlements } from '../settlement/settling.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { departmentBudgetOf } from './demo-budget.js'
import { departmentOpsOf } from './department-ops.js'
import { eventLanesOf } from './event-lanes.js'
import type { financeBudgetOf } from './finance-budget.js'
import { followUpRowsOf } from './follow-up.js'
import { opsPeopleOf } from './ops-contacts.js'
import { todoOf } from './todo.js'
import { weekOf } from './week.js'

type Reader = Pick<Db, 'select'>

// 우리 부서가 맡은 행사: 직급 부서의 끝나지 않은 업무가 이어진 행사(행사 머리의 담당 부서와 같은 뜻, EventDetail.departments).
const ourEventIdsOf = (scoped: OpenTask[]) => [
  ...new Set(scoped.flatMap(row => (row.summary.event ? [row.summary.event.id] : []))),
]

// ③ 행사 정리: 우리 부서가 맡은 행사 가운데 끝났고 완료하지 않은 것(회장단 행사 정리와 같은 셈, 끝난 지 오래된 것부터).
async function followUpOf(db: Reader, actor: Actor, now: Date, eventIds: string[]) {
  // 행사 목록 차례(listOrder)는 끝난 행사를 최근 것부터 두므로 뒤집어 회장단 행사 정리(정산 탭)와 같은 차례로 맞춘다.
  const ended = (await openEventsAmong(db, actor, now, eventIds))
    .filter(row => row.status === 'ended')
    .reverse()
  const events = await followUpRowsOf(db, await withSettlements(db, actor, ended), now)
  return { events, total: events.length }
}

// 부장 홈(HOME-01D, 10/30 확정): 회장단 홈과 같은 셈을 직급 부서 범위로 좁힌다(DEC-38, DEC-69). open은 학생회 전체의 열린 업무다.
export async function departmentBoardOf(
  db: Reader,
  actor: Actor,
  now: Date,
  { open, budget }: { open: OpenTask[]; budget: Awaited<ReturnType<typeof financeBudgetOf>> },
): Promise<HomeDepartmentBoard> {
  const departmentIds = headDepartmentIds(actor)
  const scoped = open.filter(
    row => row.summary.department && departmentIds.includes(row.summary.department.id),
  )
  const eventIds = ourEventIdsOf(scoped)
  const people = await opsPeopleOf(db, actor)
  return {
    ops: departmentOpsOf(actor, now, { scoped, people, departmentIds }),
    todo: await todoOf(db, actor, now, {
      open,
      people,
      followUp: await followUpOf(db, actor, now, eventIds),
      mine: row => row.summary.assignee?.id === actor.memberId,
    }),
    week: await weekOf(db, actor, now),
    lanes: await eventLanesOf(db, actor, now, { open: scoped, budget, eventIds }),
    budget: await departmentBudgetOf(db, actor),
  }
}
