import { and, asc, ne, sql } from 'drizzle-orm'
import {
  HOME_LIST_LIMIT,
  HOME_SOON_DAYS,
  koreanDateOf,
  type HomeMine,
  type HomeResponse,
  type HomeTask,
  type TaskStatus,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { dueGroupOf } from '../tasks/due.js'
import { assignedTo, inCouncil, summaryOf, taskSelect } from '../tasks/queries.js'

type Reader = Pick<Db, 'select'>

// 나에게 맡긴 끝나지 않은 업무. 한 사람이 맡은 열린 업무만이라 모두 읽어 같은 도우미(dueGroupOf)로 가른다.
// 묶음을 SQL로 다시 쓰면 업무 화면의 지남과 어긋날 수 있다(자주 잡힌 것 9). 정렬은 업무 목록과 같다.
async function mineOf(db: Reader, actor: Actor, now: Date): Promise<HomeMine> {
  const rows = await taskSelect(db, actor, now)
    .where(and(inCouncil(actor), assignedTo(actor), ne(task.status, 'done')))
    .orderBy(sql`${task.dueAt} asc nulls last`, asc(record.createdAt), asc(task.id))
  const counts = { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 }
  const tasks: HomeTask[] = []
  for (const row of rows) {
    const group = dueGroupOf(row.dueAt, row.status as TaskStatus, now, HOME_SOON_DAYS)
    if (group === 'none') counts.noDue++
    else counts[group]++
    if (group !== 'later' && group !== 'none' && tasks.length < HOME_LIST_LIMIT)
      tasks.push({ ...summaryOf(actor, row, now), group })
  }
  return { tasks, counts }
}

export async function homeOf(db: Reader, actor: Actor, now: Date): Promise<HomeResponse> {
  return { today: koreanDateOf(now), mine: await mineOf(db, actor, now) }
}
