import type { ExpenseChange, ExpenseVersion } from '@vada/contracts'
import type { Db } from '../db/types.js'
import { versionsOf } from '../records/versions.js'

type Reader = Pick<Db, 'select'>

// 판에 담긴 지출 줄의 칸 값. 지출은 만들고, 사유·행사를 고치고, 취소하고, 환급한다.
type Snapshot = {
  cancelled_at: string | null
  reimbursed_at: string | null
  reason: string | null
  event_id: string | null
}

// 판 사이에 값이 달라지면 보이는 바꿈. 한 판에 여럿이 같이 바뀔 수 있다.
const TRACKED: [keyof Snapshot, ExpenseChange['field']][] = [
  ['cancelled_at', 'cancelled'],
  ['reimbursed_at', 'reimbursed'],
  ['reason', 'reason'],
  ['event_id', 'event'],
]

// 지출 하나의 판 전체를 오래된 것부터. 취소한 판에는 그때 받은 사유가 붙는다.
export async function expenseHistoryOf(db: Reader, expenseId: string): Promise<ExpenseVersion[]> {
  const rows = await versionsOf(db, expenseId)
  return rows.map((row, index) => {
    const before = rows[index - 1]?.data as Snapshot | undefined
    const now = row.data as Snapshot
    const changes: ExpenseChange[] = before
      ? TRACKED.filter(([key]) => now[key] !== before[key]).map(([, field]) => ({ field }))
      : [{ field: 'created' }]
    return { versionNo: row.versionNo, at: row.at, by: row.by, changes, reason: row.reason }
  })
}
