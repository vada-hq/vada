import { HOME_LIST_LIMIT, type HomeReceived, type HomeSettling } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { requestListOf } from '../purchases/queries.js'
import { settlingOf } from './settling.js'

type Reader = Pick<Db, 'select'>

// 재정부가 먼저 보는 것. 받은 것은 재정 화면의 pending 보기(requestListOf)를 그대로 읽어 같은 요청이 같은 순서로 온다.
// 정산할 행사는 회장단이면 학생회 행사 카드에 이미 있어 같은 것을 두 부분에 싣지 않는다.
export async function financeOf(
  db: Reader,
  actor: Actor,
  now: Date,
  leadership: boolean,
): Promise<{ received: HomeReceived; settling?: HomeSettling }> {
  const pending = await requestListOf(db, actor, { view: 'pending' })
  const received: HomeReceived = {
    requests: pending.requests.slice(0, HOME_LIST_LIMIT),
    total: pending.requests.length,
    truncated: pending.truncated,
  }
  return leadership ? { received } : { received, settling: await settlingOf(db, actor, now) }
}
