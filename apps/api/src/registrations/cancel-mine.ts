import { eq } from 'drizzle-orm'
import { registration } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, updateRecord } from '../records/records.js'
import { removeLinks } from './link.js'
import { isAttended, mineRowOf } from './my-registration.js'
import { clearVersionValues } from './personal-values.js'

// 스스로 취소(DEC-44). 마감 전이고 출석 전이면 되고(멈춤이어도), 이름·학번·휴대폰을 지금 값과 모든 판에서 바로 비우고 링크를 지운다.
// 입금 기록은 008이 더한다: 이 기능의 취소는 입금이 없다고 보고 늘 바로 비운다.
// 순서: 신청 행 잠금 → 다시 읽기. 출석 확인(조각 4)이 같은 행을 먼저 잠그므로 취소와 출석이 겹쳐도 하나만 된다.
export async function cancelMine(tx: Tx, token: string, now: Date) {
  const first = await mineRowOf(tx, token)
  if (!first) throw new ApiError('NOT_FOUND')
  await tx
    .select({ id: registration.id })
    .from(registration)
    .where(eq(registration.id, first.id))
    .for('update')
  // 잠금을 기다리는 사이 다른 취소가 끝났을 수 있어 잠금 뒤에 다시 읽는다.
  const row = await mineRowOf(tx, token)
  if (!row) throw new ApiError('NOT_FOUND')
  if (await isAttended(tx, row.id)) throw new ApiError('CHECKED_IN')
  if (now.getTime() >= row.closesAt.getTime()) throw new ApiError('CANCEL_CLOSED')
  // 판의 바꾼 사람은 신청자라 비어 있다. 지금 값 변경이 새 판을 열고, 이전 판은 따로 비운다.
  await updateRecord(tx, {
    kind: 'registration',
    id: row.id,
    actor: null,
    reason: null,
    changes: { cancelledAt: clockNow, name: null, studentId: null, phone: null },
  })
  await clearVersionValues(tx, [row.id])
  await removeLinks(tx, [row.id])
}
