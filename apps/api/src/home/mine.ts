import { and, asc, ne, sql } from 'drizzle-orm'
import {
  HOME_LIST_LIMIT,
  HOME_SOON_DAYS,
  type HomeMine,
  type HomeMyTasks,
  type HomeTask,
  type TaskSummary,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { dueGroupOf } from '../tasks/due.js'
import { assignedTo, inCouncil, summaryOf, taskSelect } from '../tasks/queries.js'

type Reader = Pick<Db, 'select'>

// 나에게 맡긴 끝나지 않은 업무를 한 번 읽어 세 가지로 준다: 지금 화면의 내 업무(mine), 새 홈의 요약(myTasks), 가까운 일정이 쓰는 줄(tasks).
// 한 사람이 맡은 열린 업무만이라 모두 읽어 같은 도우미(dueGroupOf)로 가른다. 묶음을 SQL로 다시 쓰면 업무 화면의 지남과 어긋날 수 있다(자주 잡힌 것 9).
// 조건과 정렬은 업무 화면 '내 업무' 탭과 같아 수가 같다.
export async function mineOf(
  db: Reader,
  actor: Actor,
  now: Date,
): Promise<{ mine: HomeMine; myTasks: HomeMyTasks; tasks: TaskSummary[] }> {
  const rows = await taskSelect(db, actor, now)
    .where(and(inCouncil(actor), assignedTo(actor), ne(task.status, 'done')))
    .orderBy(sql`${task.dueAt} asc nulls last`, asc(record.createdAt), asc(task.id))
  const counts = { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 }
  const listed: HomeTask[] = []
  const tasks: TaskSummary[] = []
  for (const row of rows) {
    const summary = summaryOf(actor, row, now)
    tasks.push(summary)
    const group = dueGroupOf(row.dueAt, now, HOME_SOON_DAYS)
    if (group === 'none') counts.noDue++
    else counts[group]++
    if (group !== 'later' && group !== 'none' && listed.length < HOME_LIST_LIMIT)
      listed.push({ ...summary, group })
  }
  // 마감 순(없으면 뒤)이라 마감이 있는 첫 업무가 가장 이르다.
  const nearest = tasks.find(item => item.dueDate !== null) ?? null
  return {
    mine: { tasks: listed, counts },
    myTasks: { open: tasks.length, overdue: tasks.filter(item => item.overdue).length, nearest },
    tasks,
  }
}
