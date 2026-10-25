import { and, eq, ne } from 'drizzle-orm'
import { budgetItem } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'

type Named = { purpose: string; eventId: string | null }

// 같은 이름 막기(DEC-92 '같은 예산 안의 같은 이름'). 와이어프레임의 예산은 행사마다라서, 기간 하나에 예산 하나인 여기서는
// (예산, 행사) 안에서 겹치지 않게 한다. 행사 없는 항목끼리도 한 묶음이다. 그러지 않으면 행사마다 채워 두는 기본 행
// ('행사 운영비' 등)이 두 번째 행사부터 막힌다. 종류는 가리지 않는다(같은 행사의 '후원' 수입과 '후원' 지출은 헷갈린다).
// 이름은 계약이 앞뒤 공백을 걷은 값이라 그대로 견준다. 쓰기는 학생회 행 잠금 뒤라 보고 넣는 사이에 끼어드는 쓰기가 없다.
const keyOf = (row: Named) => `${row.eventId ?? ''}\u0000${row.purpose}`

export async function assertNamesFree(
  tx: Tx,
  budgetId: string,
  rows: readonly Named[],
  exceptItemId?: string,
) {
  const keys = rows.map(keyOf)
  if (new Set(keys).size !== keys.length) throw new ApiError('BUDGET_ITEM_DUPLICATE')
  const existing = await tx
    .select({ purpose: budgetItem.purpose, eventId: budgetItem.eventId })
    .from(budgetItem)
    .where(
      and(
        eq(budgetItem.budgetId, budgetId),
        exceptItemId ? ne(budgetItem.id, exceptItemId) : undefined,
      ),
    )
  const taken = new Set(existing.map(keyOf))
  if (keys.some(key => taken.has(key))) throw new ApiError('BUDGET_ITEM_DUPLICATE')
}
