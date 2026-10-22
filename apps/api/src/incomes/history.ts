import type { IncomeChange, IncomeVersion } from '@vada/contracts'
import type { Db } from '../db/types.js'
import { versionsOf } from '../records/versions.js'

type Reader = Pick<Db, 'select'>

// 판에 담긴 수입 줄의 칸 값. 수입은 적고 취소할 뿐 고치지 않는다.
type Snapshot = { cancelled_at: string | null }

// 수입 하나의 판 전체를 오래된 것부터. 취소한 판에는 그때 받은 사유가 붙는다.
export async function incomeHistoryOf(db: Reader, incomeId: string): Promise<IncomeVersion[]> {
  const rows = await versionsOf(db, incomeId)
  return rows.map((row, index) => {
    const before = rows[index - 1]?.data as Snapshot | undefined
    const now = row.data as Snapshot
    const changes: IncomeChange[] = !before
      ? [{ field: 'created' }]
      : now.cancelled_at !== before.cancelled_at
        ? [{ field: 'cancelled' }]
        : []
    return { versionNo: row.versionNo, at: row.at, by: row.by, changes, reason: row.reason }
  })
}
