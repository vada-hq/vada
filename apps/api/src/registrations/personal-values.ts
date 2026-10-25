import { sql } from 'drizzle-orm'
import type { Tx } from '../db/types.js'
import { clearVersionKeys } from '../records/clear-versions.js'

// 한 양식의 신청에 들어 있던 휴대폰 번호를 지금 값과 모든 판에서 비운다(DEC-54: 행은 남기고 값을 모든 판에서 비운다).
// 판을 새로 열지 않는다: 지금 값과 이전 판을 한 거래에서 함께 비워 어느 판에도 값이 남지 않게 한다.
export async function clearPhones(tx: Tx, formId: string) {
  await tx.execute(sql`UPDATE record_version SET data = jsonb_set(data, '{phone}', 'null'::jsonb)
    WHERE record_id IN (SELECT id FROM registration WHERE form_id = ${formId})
      AND data ->> 'phone' IS NOT NULL`)
  // 영수증의 본문 해시에 휴대폰이 들어 있어 같이 지운다(DEC-55).
  await tx.execute(sql`DELETE FROM command_receipt
    WHERE result_id IN (SELECT id FROM registration WHERE form_id = ${formId})`)
  await tx.execute(
    sql`UPDATE registration SET phone = NULL WHERE form_id = ${formId} AND phone IS NOT NULL`,
  )
}

// 입금한 신청의 취소: 이름·휴대폰 번호는 환불 연락을 위해 남기고 학번만 모든 판에서 비운다(DEC-55, 지금 값은 부르는 쪽이 비운다).
export const clearVersionStudentIds = (tx: Tx, registrationIds: string[]) =>
  clearVersionKeys(tx, registrationIds, ['student_id'])

// 신청들의 이름·학번·휴대폰을 이전 판에서 모두 비운다(지금 값은 부르는 쪽이 같은 거래에서 비운다).
// 스스로 취소와 기한 지우기가 같이 쓴다.
// DB CHECK는 취소한 신청의 학번만 요구하므로, 이름과 휴대폰까지 비웠는지는 시험이 지킨다.
export const clearVersionValues = (tx: Tx, registrationIds: string[]) =>
  clearVersionKeys(tx, registrationIds, ['name', 'student_id', 'phone'])
