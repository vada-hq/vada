import { count, eq } from 'drizzle-orm'
import {
  EVIDENCE_MAX,
  PHOTO_MEDIA_TYPE,
  type AttachEvidence,
  type ExpenseDetail,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { evidence } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { assertExpenseEventOpen } from './event-lock.js'
import { visiblePhoto } from '../chat/photos.js'
import { linkEvidence } from '../records/evidence-link.js'
import { createRecord } from '../records/records.js'
import type { VerifiedPhoto } from '../storage/uploads.js'
import { lockedExpenseRow } from './lock.js'
import { expenseDetailOf } from './queries.js'

// 증빙 사진의 저장소 키 맨 앞. 대화 사진(chat/)과 섞이지 않는다.
export const EVIDENCE_AREA = 'evidence'

// 취소·행사 잠금·20장 상한을 지출 행을 잠근 채 본다.
async function assertAttachable(tx: Tx, actor: Actor, expenseId: string) {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await lockedExpenseRow(tx, actor, expenseId)
  await assertExpenseEventOpen(tx, actor, expenseId)
  if (row.cancelledAt !== null) throw new ApiError('EXPENSE_CANCELLED')
  const [held] = await tx
    .select({ n: count() })
    .from(evidence)
    .where(eq(evidence.expenseId, expenseId))
  if ((held?.n ?? 0) >= EVIDENCE_MAX) throw new ApiError('EVIDENCE_LIMIT')
}

// 증빙을 붙이는 거래. 학생회 행 잠금과 운영진 확인(inCouncilChange) 뒤에 부른다.
// 저장소 확인은 거래 밖에서 이미 끝났다. 여기서는 취소와 20장 상한을 지출 행을 잠근 채 본다.
export async function attachEvidence(
  tx: Tx,
  actor: Actor,
  expenseId: string,
  // chat이 있으면 대화 사진을 옮긴 것이다: 사진의 메시지를 지금도 볼 수 있어야 하고 그 메시지가 근거로 남는다.
  input: { photo: VerifiedPhoto; type: AttachEvidence['type']; chat?: { photoId: string } },
): Promise<ExpenseDetail> {
  await assertAttachable(tx, actor, expenseId)
  const source = input.chat ? await visiblePhoto(tx, actor, input.chat.photoId) : undefined
  if (input.chat && !source) throw new ApiError('MESSAGE_INVALID')
  const evidenceId = await createRecord(tx, {
    kind: 'evidence',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { expenseId, type: input.type },
  })
  await createRecord(tx, {
    kind: 'file',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      name: 'evidence.jpg',
      mediaType: PHOTO_MEDIA_TYPE,
      sizeBytes: input.photo.size,
      storageKey: input.photo.key,
      attachedToId: evidenceId,
    },
  })
  if (source) await linkEvidence(tx, actor.councilId, evidenceId, source.messageId)
  return expenseDetailOf(tx, actor, expenseId)
}
