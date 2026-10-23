import { inArray } from 'drizzle-orm'
import { evidenceLink, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'

// 기록의 근거 메시지 한 줄(DEC-45). 연결 표는 기록이 아니라 바꾸거나 떼지 않는다.
// 외래 키는 학생회까지 맞추지 못해, 기록과 메시지가 모두 이 학생회의 것인지 여기서 본다.
// 메시지를 지금 볼 수 있는지는 부르는 쪽이 이미 본다(chat/photos.ts의 visibleMessage).
export async function linkEvidence(tx: Tx, councilId: string, recordId: string, messageId: string) {
  const owners = await tx
    .select({ id: record.id, councilId: record.councilId })
    .from(record)
    .where(inArray(record.id, [recordId, messageId]))
  const councilOf = (id: string) => owners.find(owner => owner.id === id)?.councilId
  // 기록이 이 학생회의 것이 아니면 부른 쪽의 잘못이다(만든 직후에만 부른다).
  if (councilOf(recordId) !== councilId) throw new Error('evidence_link: 기록의 학생회가 다르다')
  if (councilOf(messageId) !== councilId) throw new ApiError('MESSAGE_INVALID')
  await tx.insert(evidenceLink).values({ recordId, messageId })
}
