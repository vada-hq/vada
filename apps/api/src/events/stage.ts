import type { TaskResultStage } from '@vada/contracts'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../policy/locks.js'

// 행사가 업무 결과물로서 어느 단계인가(RULE-41, DEC-82). 읽기만 하고 저장하지 않는다.
// 완료면 끝남, 아니면 없음이다. 완료 여부는 마지막 완료 결재 한 곳(completedEventIdsAmong)에서 나오므로, 완료 취소는 단계를 내릴 뿐이다.
export async function eventStagesOf(
  db: Pick<Db, 'select'>,
  eventIds: readonly string[],
): Promise<Map<string, TaskResultStage>> {
  const completed = await completedEventIdsAmong(db, [...eventIds])
  return new Map(eventIds.map(id => [id, completed.has(id) ? 'finished' : 'none']))
}
