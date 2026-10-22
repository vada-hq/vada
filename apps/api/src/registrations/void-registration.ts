import type { Tx } from '../db/types.js'
import { clockNow, updateRecord } from '../records/records.js'
import { removeLinks } from './link.js'
import { clearVersionValues } from './personal-values.js'

// 신청을 취소하고 이름·학번·휴대폰을 지금 값과 모든 판에서 바로 비우고 링크를 지운다.
// 입금 기록은 008이 더한다: 이 기능의 취소는 입금이 없다고 보고 늘 바로 비운다.
// 스스로 취소(actor 없음)와 운영진 취소가 같이 쓴다. 판의 바꾼 사람은 부르는 쪽이 정한다.
export async function voidRegistration(tx: Tx, registrationId: string, actor: string | null) {
  await updateRecord(tx, {
    kind: 'registration',
    id: registrationId,
    actor,
    reason: null,
    changes: { cancelledAt: clockNow, name: null, studentId: null, phone: null },
  })
  await clearVersionValues(tx, [registrationId])
  await removeLinks(tx, [registrationId])
}
