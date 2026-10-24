import { inArray } from 'drizzle-orm'
import type { TaskResultStage } from '@vada/contracts'
import { message } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 공지가 업무 결과물로서 어느 단계인가(RULE-41, DEC-82, DEC-14). 읽기만 하고 저장하지 않는다.
// 공지 표시가 있으면 끝남이고, 뗐으면 빠짐이다(다시 붙이면 다시 끝남이 된다). 메시지를 지우는 길은 없다.
export async function noticeStagesOf(
  db: Pick<Db, 'select'>,
  messageIds: readonly string[],
): Promise<Map<string, TaskResultStage>> {
  if (!messageIds.length) return new Map()
  const rows = await db
    .select({ id: message.id, isNotice: message.isNotice })
    .from(message)
    .where(inArray(message.id, [...messageIds]))
  return new Map(rows.map(row => [row.id, row.isNotice ? 'finished' : 'excluded']))
}
