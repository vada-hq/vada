import { and, eq } from 'drizzle-orm'
import type { BulkApplicantsResponse } from '@vada/contracts'
import { authorize, inCouncilChange, type AccessRequest } from '../access/authorize.js'
import type { Actor } from '../access/actor.js'
import { registration, registrationForm } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { confirmDeposit } from '../deposits/service.js'
import { eventRowOf } from '../events/queries.js'
import { ApiError } from '../http/errors.js'
import { checkInManually } from './attendance.js'

export type BulkApplicantAction = 'deposit' | 'attendance'
async function applyToApplicant(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; registrationId: string; action: BulkApplicantAction; ip: string },
) {
  const [row] = await tx
    .select({ id: registration.id })
    .from(registration)
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .where(
      and(eq(registration.id, target.registrationId), eq(registrationForm.eventId, target.eventId)),
    )
  if (!row) throw new ApiError('NOT_FOUND')
  if (target.action === 'deposit') await confirmDeposit(tx, actor, row.id, { amount: null })
  else await checkInManually(tx, actor, { registrationId: row.id, ip: target.ip })
}

// 각 줄을 별도 거래로 처리한다. 앞 줄의 성공이 뒤 줄의 거절로 되돌아가지 않는다.
export async function bulkApplicants(
  db: Db,
  request: AccessRequest,
  target: { eventId: string; registrationIds: string[]; action: BulkApplicantAction; ip: string },
  unexpected: (error: unknown) => void,
): Promise<BulkApplicantsResponse> {
  await db.transaction(async tx => eventRowOf(tx, await authorize(tx, request), target.eventId))
  const results: BulkApplicantsResponse['results'] = []
  for (const id of target.registrationIds) {
    const registrationId = id.toLowerCase()
    try {
      await inCouncilChange(db, request, async (tx, actor) => {
        await eventRowOf(tx, actor, target.eventId)
        await applyToApplicant(tx, actor, { ...target, registrationId })
      })
      results.push({ registrationId, error: null })
    } catch (error) {
      if (!(error instanceof ApiError)) unexpected(error)
      results.push({
        registrationId,
        error: error instanceof ApiError ? error.code : 'REQUEST_FAILED',
      })
    }
  }
  return { results }
}
