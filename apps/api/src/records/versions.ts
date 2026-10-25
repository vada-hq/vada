import { asc, eq, sql } from 'drizzle-orm'
import { recordVersion } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { councilOfRecord, memberNamesOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

export interface RecordVersionRow {
  versionNo: number
  at: string
  by: { id: string; name: string } | null
  // 판에 담긴 하위 행의 칸 값(to_jsonb라 칸 이름이 표의 이름이다)
  data: unknown
  reason: string | null
}

// 기록 하나의 판 전체를 오래된 것부터, 바꾼 사람의 이름과 함께. 무엇이 바뀌었는지는 종류마다 부르는 쪽이 data로 가린다.
export async function versionsOf(db: Reader, recordId: string): Promise<RecordVersionRow[]> {
  const rows = await db
    .select({
      versionNo: recordVersion.versionNo,
      openedAt: sql<number>`extract(epoch from lower(${recordVersion.valid})) * 1000`.mapWith(
        Number,
      ),
      changedBy: recordVersion.changedBy,
      data: recordVersion.data,
      reason: recordVersion.reason,
    })
    .from(recordVersion)
    .where(eq(recordVersion.recordId, recordId))
    .orderBy(asc(recordVersion.versionNo))
  const names = await memberNamesOf(
    db,
    councilOfRecord(recordId),
    rows.flatMap(row => (row.changedBy ? [row.changedBy] : [])),
  )
  return rows.map(row => {
    const name = row.changedBy ? names.get(row.changedBy) : undefined
    return {
      versionNo: row.versionNo,
      at: new Date(Math.round(row.openedAt)).toISOString(),
      by: row.changedBy && name ? { id: row.changedBy, name } : null,
      data: row.data,
      reason: row.reason,
    }
  })
}
