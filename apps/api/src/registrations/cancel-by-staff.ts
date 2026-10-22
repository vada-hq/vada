import type { Actor } from '../access/actor.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { isAttended } from './my-registration.js'
import { lockedLiveRegistration } from './staff-registration.js'
import { voidRegistration } from './void-registration.js'

// 운영진 취소(DEC-44). 마감 뒤에도 되고, 출석 뒤는 출석을 먼저 취소해야 한다(409 CHECKED_IN).
// 스스로 취소와 같은 신청 행 잠금 뒤 다시 읽기라 취소와 출석이 겹쳐도 하나만 된다. 판의 바꾼 사람은 운영진이다.
export async function cancelByStaff(tx: Tx, actor: Actor, registrationId: string) {
  const row = await lockedLiveRegistration(tx, actor, registrationId)
  if (await isAttended(tx, row.id)) throw new ApiError('CHECKED_IN')
  await voidRegistration(tx, row.id, actor.memberId)
}
