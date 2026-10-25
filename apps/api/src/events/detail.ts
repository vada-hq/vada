import type { EventDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { completionApprovalsOf } from './completion.js'
import { eventHeaderOf } from './header.js'
import { eventHistoryOf } from './history.js'
import { actionsOf, blockersOf, factsOf } from './policy.js'
import { eventRowOf, summariesOf, taskCountsByEvent } from './queries.js'

// 행사 하나와 머리의 셈(header.ts), 그 사람이 할 수 있는 동작(events/policy.ts). 동작은 쓰기의 거절과 같은 판정이다.
// queries.ts와 따로 둔다: 머리의 셈은 업무 읽기(tasks/)를 쓰고 업무 읽기는 queries.ts의 행사 행을 쓰므로, 한 파일이면 서로 부른다.
export async function eventDetailOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  eventId: string,
  now: Date,
): Promise<EventDetail> {
  const row = await eventRowOf(db, actor, eventId)
  const [summary] = await summariesOf(db, actor, [row], now)
  const facts = await factsOf(db, actor, row, { now })
  return {
    ...summary!,
    tasks: (await taskCountsByEvent(db, [eventId])).get(eventId) ?? { open: 0, total: 0 },
    ...(await eventHeaderOf(db, actor, row, { status: summary!.status, now })),
    history: await eventHistoryOf(db, eventId),
    approvals: await completionApprovalsOf(db, eventId),
    actions: actionsOf(actor, facts),
    blockers: blockersOf(actor, facts),
  }
}
