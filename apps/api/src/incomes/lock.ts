import type { Actor } from '../access/actor.js'
import { budgetItemEventsOf } from '../budget/queries.js'
import type { Db, Tx } from '../db/types.js'
import { assertEventsOpen, completedEventIdsAmong } from '../events/completion.js'

type Reader = Pick<Db, 'select'>

// 수입을 적고 취소하는 거래가 부르는 잠금 확인은 여기 한 곳이다(합계를 바꾸는 쓰기). 권한을 본 뒤, 쓰기 전에 부른다(403이 409보다 먼저다).
// 완료한 행사의 수입 예산 항목을 고르는 수입은 그 행사의 기록이라 잠겼다(DEC-68): 409 EVENT_COMPLETED.
// 결산 공개 잠금(PERIOD_CLOSED)은 조각 4가 이 함수에 더한다. 둘 다 걸리면 EVENT_COMPLETED가 먼저라서 행사 확인 뒤에 둔다.
export async function assertIncomeWritable(
  tx: Tx,
  actor: Actor,
  target: { budgetItemId: string | null },
) {
  const events = target.budgetItemId
    ? await budgetItemEventsOf(tx, actor, [target.budgetItemId])
    : []
  await assertEventsOpen(tx, events)
}

// 읽기: 쓰기와 같은 판단(그 항목의 행사가 완료인가)이다. 잠긴 취소를 actions에서 뺄 때 쓴다.
export async function isIncomeLocked(
  db: Reader,
  actor: Actor,
  target: { budgetItemId: string | null },
) {
  const events = target.budgetItemId
    ? await budgetItemEventsOf(db, actor, [target.budgetItemId])
    : []
  return (await completedEventIdsAmong(db, events)).size > 0
}
