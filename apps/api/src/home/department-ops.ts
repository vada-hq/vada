import {
  HOME_OPS_ROW_LIMIT,
  daysBetween,
  koreanDateOf,
  type HomeOps,
  type HomeOpsRow,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { personOf, type OpsPeople } from './ops-contacts.js'
import { byKind, dueKindOf, kindCountsOf } from './ops.js'

// 부장 홈 ①의 일 줄: 직급 부서 업무 가운데 담당자가 있고 내가 아닌 것(내 업무는 ③ 몫). 연락할 사람은 그 담당자다(부장은 자기 부원에게 묻는다).
function rowsOf(scoped: OpenTask[], people: OpsPeople, actor: Actor, today: string) {
  const rows: HomeOpsRow[] = []
  for (const row of scoped) {
    const { dueDate, assignee } = row.summary
    if (row.unassigned || !assignee || assignee.id === actor.memberId || dueDate === null) continue
    const lateDays = daysBetween(dueDate, today)
    const kind = dueKindOf(lateDays)
    if (!kind) continue
    rows.push({
      kind,
      target: { kind: 'task', id: row.summary.id },
      title: row.summary.title,
      days: Math.abs(lateDays),
      event: row.summary.event,
      contact: personOf(people, assignee.id, { kind: 'assignee' }),
      noHead: null,
      actions: [],
    })
  }
  return rows
}

// 부장 홈 ① 확인이 필요한 운영 상황(우리 부서, 10/30 확정). scoped는 직급 부서의 열린 업무(마감 순)다.
// 결재 대기·부서 미정·미배정 구성원·재정 담당은 회장단(재정부) 몫이라 싣지 않는다. 담당자 없는 업무는 부장이 배정할 일로 센다.
export function departmentOpsOf(
  actor: Actor,
  now: Date,
  board: { scoped: OpenTask[]; people: OpsPeople; departmentIds: string[] },
): HomeOps {
  const { people } = board
  const rows = rowsOf(board.scoped, people, actor, koreanDateOf(now)).sort(byKind)
  const counts = kindCountsOf(rows)
  const noAssignee = board.scoped.filter(row => row.unassigned).length
  return {
    rows: rows.slice(0, HOME_OPS_ROW_LIMIT),
    counts,
    assign: {
      by: 'head',
      noAssignee,
      departments: people.departments
        .filter(row => board.departmentIds.includes(row.id))
        .map(({ id, name }) => ({ id, name })),
    },
    total: rows.length + noAssignee,
  }
}
