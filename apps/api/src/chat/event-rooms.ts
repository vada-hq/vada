import type { EventRoomsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { eventRowOf } from '../events/queries.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import { byDisplayOrder, summariesOf } from './queries.js'

type ListReader = Pick<Db, 'select' | 'selectDistinctOn'>

// 행사 메시지 탭의 방(DEC-90): 그 행사의 공지방과 내가 든 부서방. 대화 목록과 달리 메시지가 없어도 준다(탭이 입구라서).
// 다른 학생회의 행사나 없는 행사는 404다(있는지 드러내지 않는다). 완료한 행사는 보관이라 읽기만 되고 방마다 readOnly다.
export async function eventRoomsOf(
  db: ListReader,
  actor: Actor,
  now: Date,
  eventId: string,
): Promise<EventRoomsResponse> {
  const row = await eventRowOf(db, actor, eventId)
  const rooms = (await summariesOf(db, actor, now))
    .filter(room => room.eventId === row.id)
    .sort(byDisplayOrder)
  return { rooms, archived: (await completedEventIdsAmong(db, [row.id])).has(row.id) }
}
