import type { PurchaseChange, PurchaseVersion } from '@vada/contracts'
import type { Db } from '../db/types.js'
import { versionsOf } from '../records/versions.js'

type Reader = Pick<Db, 'select'>

// 판에 담긴 요청 줄의 칸 값. 요청은 만들고 취소하는 것뿐이다.
type Snapshot = { cancelled_at: string | null }

// 요청 하나의 판 전체를 오래된 것부터. 판 1은 '만듦'이고, 그다음부터는 취소한 판이다. 만든 사람은 판 1의 바꾼 사람이다.
export async function requestHistoryOf(db: Reader, requestId: string): Promise<PurchaseVersion[]> {
  const rows = await versionsOf(db, requestId)
  return rows.map((row, index) => {
    const previous = rows[index - 1]?.data as Snapshot | undefined
    const changes: PurchaseChange[] = !previous
      ? [{ field: 'created' }]
      : (row.data as Snapshot).cancelled_at !== previous.cancelled_at
        ? [{ field: 'cancelled' }]
        : []
    return { versionNo: row.versionNo, at: row.at, by: row.by, changes }
  })
}
