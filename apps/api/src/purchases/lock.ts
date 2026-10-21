import { eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { request } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { requestRowOf } from './queries.js'

// 요청 행을 잠그고 잠근 뒤의 값을 돌려준다. 취소와 결재가 겹치면 이 잠금 뒤에 하나만 된다: 나중 거래는 앞 거래가 끝난 값(취소 여부, 결재 수)을 읽는다.
// 앞의 읽기는 없는 요청과 다른 학생회의 요청을 잠그기 전에 404로 거르려는 것이다. 호출은 학생회 행 잠금과 운영진 확인 뒤다.
export async function lockedRequestRow(tx: Tx, actor: Actor, requestId: string) {
  await requestRowOf(tx, actor, requestId)
  await tx
    .select({ id: request.id })
    .from(request)
    .where(eq(request.id, requestId))
    .for('no key update')
  return requestRowOf(tx, actor, requestId)
}
