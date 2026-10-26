import { sql, type SQL } from 'drizzle-orm'
import { koreanDateOf } from '@vada/contracts'
import type { Tx } from '../db/types.js'
import { feePayment } from '../db/schema.js'
import { clearVersionKeys, idList } from '../records/clear-versions.js'

// 납부 학번을 지금 값과 모든 판에서 비운다(DEC-54: 행은 남기고 값을 모든 판에서 비운다). where는 fee_payment 표의 조건이다.
// 판을 새로 열지 않는다. 지금 값을 비우기 전에 판을 먼저 비워야 대상을 같은 조건으로 찾는다.
export async function clearFeeStudentIds(tx: Tx, where: SQL) {
  const rows = await tx
    .select({ id: feePayment.id })
    .from(feePayment)
    .where(sql`student_id IS NOT NULL AND ${where}`)
  if (!rows.length) return
  const ids = rows.map(row => row.id)
  await clearVersionKeys(tx, ids, ['student_id'])
  await tx.execute(sql`UPDATE fee_payment SET student_id = NULL WHERE id IN ${idList(ids)}`)
}

// 납부 끝날 + 1년(DEC-55)이 지난 학번을 비운다. 날짜 계산을 DB 달력에 맡기므로 2월 29일에 끝난 기간은 다음 해 3월 1일에 지워진다
// (신청자 정보의 지울 날 purgeOnOf와 같은 규칙이다). 같은 일을 두 번 해도 같다.
export async function purgeDuesStudentIds(tx: Tx, now: Date) {
  const today = koreanDateOf(now)
  await clearFeeStudentIds(tx, sql`paid_until <= (${today}::date - interval '1 year')`)
}
