import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { isAttended, mineRowOf } from './my-registration.js'
import { lockRegistration } from './registration-lock.js'
import { voidRegistration } from './void-registration.js'

// 스스로 취소(DEC-44). 마감 전이고 출석 전이면 되고(멈춤이어도), 이름·학번·휴대폰을 지금 값과 모든 판에서 바로 비우고 링크를 지운다.
// 순서: 신청 행 잠금 → 다시 읽기. 출석 확인과 운영진 취소가 같은 행을 먼저 잠그므로 취소와 출석이 겹쳐도 하나만 된다.
export async function cancelMine(tx: Tx, token: string, now: Date) {
  const first = await mineRowOf(tx, token)
  if (!first) throw new ApiError('NOT_FOUND')
  await lockRegistration(tx, first.id)
  // 잠금을 기다리는 사이 다른 취소가 끝났을 수 있어 잠금 뒤에 다시 읽는다.
  const row = await mineRowOf(tx, token)
  if (!row) throw new ApiError('NOT_FOUND')
  if (await isAttended(tx, row.id)) throw new ApiError('CHECKED_IN')
  if (now.getTime() >= row.closesAt.getTime()) throw new ApiError('CANCEL_CLOSED')
  // 판의 바꾼 사람은 신청자라 비어 있다.
  await voidRegistration(tx, row.id, null)
}
