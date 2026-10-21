import type { ExpenseChange, ExpenseVersion } from '@vada/contracts'
import type { Db } from '../db/types.js'
import { versionsOf } from '../records/versions.js'

type Reader = Pick<Db, 'select'>

// 판에 담긴 지출 줄의 칸 값. 지출은 만들고, 취소하고, 환급하는 것뿐이다.
type Snapshot = { cancelled_at: string | null; reimbursed_at: string | null }

// 지출 하나의 판 전체를 오래된 것부터. 취소한 판에는 그때 받은 사유가 붙는다.
export async function expenseHistoryOf(db: Reader, expenseId: string): Promise<ExpenseVersion[]> {
  const rows = await versionsOf(db, expenseId)
  return rows.map((row, index) => {
    const before = rows[index - 1]?.data as Snapshot | undefined
    const now = row.data as Snapshot
    const changes: ExpenseChange[] = !before ? [{ field: 'created' }] : []
    if (before && now.cancelled_at !== before.cancelled_at) changes.push({ field: 'cancelled' })
    if (before && now.reimbursed_at !== before.reimbursed_at) changes.push({ field: 'reimbursed' })
    return { versionNo: row.versionNo, at: row.at, by: row.by, changes, reason: row.reason }
  })
}
