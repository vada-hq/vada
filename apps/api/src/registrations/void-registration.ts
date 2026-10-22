import { activeDepositOf } from '../deposits/queries.js'
import type { Tx } from '../db/types.js'
import { clockNow, updateRecord } from '../records/records.js'
import { removeLinks } from './link.js'
import { clearVersionStudentIds, clearVersionValues } from './personal-values.js'

// 신청을 취소하고 이름·학번·휴대폰을 지금 값과 모든 판에서 바로 비우고 링크를 지운다.
// 입금한 신청(취소하지 않은 입금 기록이 있다)은 환불 연락을 위해 이름·휴대폰 번호를 남기고 학번만 비운다(DEC-55). 환불함이나 입금 확인 취소가 나머지를 비운다.
// 스스로 취소(actor 없음)와 운영진 취소가 같이 쓴다. 판의 바꾼 사람은 부르는 쪽이 정한다.
export async function voidRegistration(tx: Tx, registrationId: string, actor: string | null) {
  const refundPending = (await activeDepositOf(tx, registrationId)) !== null
  await updateRecord(tx, {
    kind: 'registration',
    id: registrationId,
    actor,
    reason: null,
    changes: refundPending
      ? { cancelledAt: clockNow, studentId: null }
      : { cancelledAt: clockNow, name: null, studentId: null, phone: null },
  })
  if (refundPending) await clearVersionStudentIds(tx, [registrationId])
  else await clearVersionValues(tx, [registrationId])
  await removeLinks(tx, [registrationId])
}
