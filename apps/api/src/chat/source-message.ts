import type { Actor } from '../access/actor.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { linkEvidence } from '../records/evidence-link.js'
import { canSeeMessage } from './photos.js'

// 요청·지출을 만든 거래에서 그 메시지를 근거로 잇는다(DEC-45). 내가 지금 볼 수 있는 메시지만 되고,
// 아니면 있는지도 드러내지 않는 같은 409다. 거래가 실패하면 만든 기록도 함께 없어진다.
export async function linkSourceMessage(
  tx: Tx,
  actor: Actor,
  recordId: string,
  messageId: string | null,
) {
  if (messageId === null) return
  if (!(await canSeeMessage(tx, actor, messageId))) throw new ApiError('MESSAGE_INVALID')
  await linkEvidence(tx, actor.councilId, recordId, messageId)
}
