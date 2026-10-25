import { inArray } from 'drizzle-orm'
import type { TaskResultStage } from '@vada/contracts'
import { message } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 공지가 업무 결과물로서 어느 단계인가(RULE-41, DEC-82, DEC-90). 공지는 공지방에 올린 메시지라 올리면 끝남이다.
// 지운 공지는 빠짐이다(DEC-54, 취소한 요청과 같은 규칙). 읽기만 하고 저장하지 않는다.
export async function noticeStagesOf(
  db: Pick<Db, 'select'>,
  messageIds: readonly string[],
): Promise<Map<string, TaskResultStage>> {
  if (!messageIds.length) return new Map()
  const rows = await db
    .select({ id: message.id, deletedAt: message.deletedAt })
    .from(message)
    .where(inArray(message.id, [...messageIds]))
  return new Map(rows.map(row => [row.id, row.deletedAt ? 'excluded' : 'finished']))
}
