import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { PurchaseChange, PurchaseVersion } from '@vada/contracts'
import { member, recordVersion } from '../db/schema.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>

// 판에 담긴 요청 줄의 칸 값(to_jsonb라 칸 이름이 표의 이름이다). 요청은 만들고 취소하는 것뿐이다.
type Snapshot = { cancelled_at: string | null }

// 요청 하나의 판 전체를 오래된 것부터. 판 1은 '만듦'이고, 그다음부터는 취소한 판이다. 만든 사람은 판 1의 바꾼 사람이다.
export async function requestHistoryOf(db: Reader, requestId: string): Promise<PurchaseVersion[]> {
  const rows = await db
    .select({
      versionNo: recordVersion.versionNo,
      openedAt: sql<number>`extract(epoch from lower(${recordVersion.valid})) * 1000`.mapWith(
        Number,
      ),
      changedBy: recordVersion.changedBy,
      data: recordVersion.data,
    })
    .from(recordVersion)
    .where(eq(recordVersion.recordId, requestId))
    .orderBy(asc(recordVersion.versionNo))
  const ids = [...new Set(rows.flatMap(row => (row.changedBy ? [row.changedBy] : [])))]
  const people = ids.length
    ? await db
        .select({ id: member.id, name: member.name })
        .from(member)
        .where(inArray(member.id, ids))
    : []
  const names = new Map(people.map(person => [person.id, person.name]))
  return rows.map((row, index) => {
    const previous = rows[index - 1]?.data as Snapshot | undefined
    const changes: PurchaseChange[] = !previous
      ? [{ field: 'created' }]
      : (row.data as Snapshot).cancelled_at !== previous.cancelled_at
        ? [{ field: 'cancelled' }]
        : []
    const name = row.changedBy ? names.get(row.changedBy) : undefined
    return {
      versionNo: row.versionNo,
      at: new Date(Math.round(row.openedAt)).toISOString(),
      by: row.changedBy && name ? { id: row.changedBy, name } : null,
      changes,
    }
  })
}
