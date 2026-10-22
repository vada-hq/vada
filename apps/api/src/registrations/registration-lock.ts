import { eq } from 'drizzle-orm'
import { registration } from '../db/schema.js'
import type { Tx } from '../db/types.js'

// 신청 행 잠금. 스스로 취소, 운영진 취소, 출석 확인과 취소가 모두 이 잠금을 먼저 잡고 다시 읽어, 겹쳐도 하나만 된다.
// 잠금을 기다리는 사이 다른 거래가 끝났을 수 있어 부르는 쪽은 잠근 뒤에 다시 읽어야 한다(READ COMMITTED).
export async function lockRegistration(tx: Tx, registrationId: string) {
  await tx
    .select({ id: registration.id })
    .from(registration)
    .where(eq(registration.id, registrationId))
    .for('update')
}
