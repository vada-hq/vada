import { and, eq, isNull } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { cohortIsCurrent } from '../access/current-cohort.js'
import { lockCouncil } from '../access/authorize.js'
import { linkMember } from '../councils/link.js'
import {
  cohort,
  council,
  councilMembership,
  departmentMembership,
  inviteCode,
} from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecords, type AnyRecordChange } from '../records/records.js'
import type { Db, Tx } from '../db/types.js'
import { freshInviteCode } from './code.js'

// 초대 코드로 학생회를 찾는다. 형식이 틀린 코드와 없는 코드를 구분하지 않는다. 둘 다 404다.
export async function invitedCouncil(db: Pick<Db, 'select'>, code: string) {
  const [found] = await db
    .select({ id: council.id, name: council.name })
    .from(inviteCode)
    .innerJoin(council, eq(council.id, inviteCode.councilId))
    .where(eq(inviteCode.code, code))
  if (!found) throw new ApiError('NOT_FOUND')
  return found
}

// 초대 링크로 들어오기(바탕 spec G3, G4): 지금 기수에 직급과 부서 없이 바로 들어온다.
// 이미 지금 소속이면 아무것도 바꾸지 않는다. 내보내졌던 사람은 같은 소속을 다시 연다. 직급과 부서는 돌아오지 않는다:
// 다시 열기 전에 그 기수에 끝나지 않고 남은 부서 소속(재정부 포함)을 함께 끝낸다.
export async function joinCouncil(
  tx: Tx,
  userId: string,
  code: string,
  now: Date,
): Promise<string> {
  const { id: councilId } = await invitedCouncil(tx, code)
  // 학생회 행을 잠가 코드 바꾸기, 내보내기와 한 번에 하나씩 처리한다(authorizeChange와 같은 잠금). 잠근 뒤 코드가 아직 그 학생회의 것인지 다시 본다.
  await lockCouncil(tx, councilId)
  const [still] = await tx
    .select({ code: inviteCode.code })
    .from(inviteCode)
    .where(and(eq(inviteCode.councilId, councilId), eq(inviteCode.code, code)))
  if (!still) throw new ApiError('NOT_FOUND')
  const [current] = await tx
    .select({ id: cohort.id })
    .from(cohort)
    .where(and(eq(cohort.councilId, councilId), cohortIsCurrent(now)))
  if (!current) throw new ApiError('NO_CURRENT_COHORT')
  const memberId = await linkMember(tx, userId)
  const [membership] = await tx
    .select({ id: councilMembership.id, endsAt: councilMembership.endsAt })
    .from(councilMembership)
    .where(
      and(eq(councilMembership.memberId, memberId), eq(councilMembership.cohortId, current.id)),
    )
  if (!membership) {
    await createRecord(tx, {
      kind: 'council_membership',
      councilId,
      actor: memberId,
      values: { memberId, cohortId: current.id, startsAt: clockNow },
    })
  } else if (membership.endsAt !== null) {
    const open = await tx
      .select({ id: departmentMembership.id })
      .from(departmentMembership)
      .where(
        and(
          eq(departmentMembership.memberId, memberId),
          eq(departmentMembership.cohortId, current.id),
          isNull(departmentMembership.endsAt),
        ),
      )
    const changes: AnyRecordChange[] = [
      ...open.map(item => ({
        kind: 'department_membership' as const,
        id: item.id,
        actor: memberId,
        reason: null,
        changes: { endsAt: clockNow },
      })),
      {
        kind: 'council_membership',
        id: membership.id,
        actor: memberId,
        reason: null,
        changes: { startsAt: clockNow, endsAt: null, councilRank: null },
      },
    ]
    await updateRecords(tx, changes)
  }
  return councilId
}

// 초대 코드 바꾸기: 이 학생회의 코드 한 줄을 새 코드로 바꾸고 새 코드를 돌려준다. 바꾸면 옛 코드로는 들어올 수 없다(DEC-47).
// 학생회 행을 잠근 거래 안에서 부른다(inCouncilChange). 같은 학생회의 코드 바꾸기와 들어오기가 한 번에 하나씩 처리된다.
export async function rotateInviteCode(tx: Tx, actor: Actor): Promise<string> {
  const next = await freshInviteCode(tx)
  await tx
    .update(inviteCode)
    .set({ code: next, createdBy: actor.memberId, createdAt: clockNow })
    .where(eq(inviteCode.councilId, actor.councilId))
  return next
}
