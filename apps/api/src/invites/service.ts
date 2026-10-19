import { and, eq, gte, lte } from 'drizzle-orm'
import { koreanDate } from '../access/actor.js'
import { linkMember } from '../councils/link.js'
import { cohort, council, councilMembership, inviteCode } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord, type Db, type Tx } from '../records/records.js'

// 초대 코드로 학생회를 찾는다. 형식이 틀린 코드와 없는 코드를 구분하지 않는다. 둘 다 404다.
export async function invitedCouncil(db: Pick<Db, 'select'>, code: string) {
  const [found] = await db.select({ id: council.id, name: council.name }).from(inviteCode)
    .innerJoin(council, eq(council.id, inviteCode.councilId)).where(eq(inviteCode.code, code))
  if (!found) throw new ApiError('NOT_FOUND', 404)
  return found
}

// 초대 링크로 들어오기(바탕 spec G3, G4): 지금 기수에 직급과 부서 없이 바로 들어온다.
// 이미 지금 소속이면 아무것도 바꾸지 않는다. 내보내졌던 사람은 같은 소속을 다시 연다. 직급과 부서는 돌아오지 않는다.
export async function joinCouncil(tx: Tx, userId: string, code: string, now: Date): Promise<string> {
  const { id: councilId } = await invitedCouncil(tx, code)
  // 학생회 행을 잠가 코드 바꾸기, 내보내기와 한 번에 하나씩 처리한다(FOR NO KEY UPDATE, authorizeChange와 같다). 잠근 뒤 코드가 아직 그 학생회의 것인지 다시 본다.
  await tx.select({ id: council.id }).from(council).where(eq(council.id, councilId)).for('no key update')
  const [still] = await tx.select({ code: inviteCode.code }).from(inviteCode).where(and(eq(inviteCode.councilId, councilId), eq(inviteCode.code, code)))
  if (!still) throw new ApiError('NOT_FOUND', 404)
  const today = koreanDate(now)
  const [current] = await tx.select({ id: cohort.id }).from(cohort)
    .where(and(eq(cohort.councilId, councilId), lte(cohort.startsOn, today), gte(cohort.endsOn, today)))
  if (!current) throw new ApiError('NO_CURRENT_COHORT', 409)
  const memberId = await linkMember(tx, userId)
  const [membership] = await tx.select({ id: councilMembership.id, endsAt: councilMembership.endsAt }).from(councilMembership)
    .where(and(eq(councilMembership.memberId, memberId), eq(councilMembership.cohortId, current.id)))
  if (!membership) {
    await createRecord(tx, { kind: 'council_membership', councilId, actor: memberId, values: { memberId, cohortId: current.id, startsAt: clockNow } })
  } else if (membership.endsAt !== null) {
    await updateRecord(tx, { kind: 'council_membership', id: membership.id, actor: memberId, reason: null,
      changes: { startsAt: clockNow, endsAt: null, councilRank: null } })
  }
  return councilId
}
