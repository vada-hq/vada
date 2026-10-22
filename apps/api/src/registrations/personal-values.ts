import { sql } from 'drizzle-orm'
import type { Tx } from '../db/types.js'

// 한 양식의 신청에 들어 있던 휴대폰 번호를 지금 값과 모든 판에서 비운다(DEC-54: 행은 남기고 값을 모든 판에서 비운다).
// 판을 새로 열지 않는다: 지금 값과 이전 판을 한 거래에서 함께 비워 어느 판에도 값이 남지 않게 한다.
export async function clearPhones(tx: Tx, formId: string) {
  await tx.execute(sql`UPDATE record_version SET data = jsonb_set(data, '{phone}', 'null'::jsonb)
    WHERE record_id IN (SELECT id FROM registration WHERE form_id = ${formId})
      AND data ->> 'phone' IS NOT NULL`)
  await tx.execute(
    sql`UPDATE registration SET phone = NULL WHERE form_id = ${formId} AND phone IS NOT NULL`,
  )
}
