import { and, eq, isNull } from 'drizzle-orm'
import type { InvitePreviewResponse, JoinCouncilRequest } from '@vada/contracts'
import { actorOf, type Actor } from '../access/actor.js'
import { cohortIsCurrent } from '../access/current-cohort.js'
import { lockCouncil } from '../access/authorize.js'
import { syncRooms } from '../chat/rooms.js'
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

type Reader = Pick<Db, 'select'>

// 초대 코드로 학생회를 찾는다. 형식이 틀린 코드와 없는 코드를 구분하지 않는다. 둘 다 404다.
export async function invitedCouncil(db: Reader, code: string) {
  const [found] = await db
    .select({
      id: council.id,
      name: council.name,
      unit: council.unit,
      schoolName: council.schoolName,
    })
    .from(inviteCode)
    .innerJoin(council, eq(council.id, inviteCode.councilId))
    .where(eq(inviteCode.code, code))
  if (!found) throw new ApiError('NOT_FOUND')
  return found
}

// 초대 확인: 맞는 학생회인지 가릴 이름, 유형, 학교와 지금 기수 이름, 그리고 이미 지금 기수에 들어왔는지.
// 코드만 알면 볼 수 있으므로 운영진 수·이름과 초대한 사람은 싣지 않는다(DEC-87). 지금 기수가 없으면 기수 이름은 null이다.
export async function invitePreview(
  db: Reader,
  userId: string,
  code: string,
  now: Date,
): Promise<InvitePreviewResponse> {
  const found = await invitedCouncil(db, code)
  const [current] = await db
    .select({ name: cohort.name })
    .from(cohort)
    .where(and(eq(cohort.councilId, found.id), cohortIsCurrent(now)))
  const joined = (await actorOf(db, userId, found.id, now)) !== null
  return { council: { ...found, cohortName: current?.name ?? null }, joined }
}

// 학생회 행을 잠가 코드 바꾸기, 내보내기와 한 번에 하나씩 처리한다(authorizeChange와 같은 잠금). 잠근 뒤 코드가 아직 그 학생회의 것인지 다시 본다.
async function lockInvitedCouncil(tx: Tx, code: string) {
  const { id: councilId } = await invitedCouncil(tx, code)
  await lockCouncil(tx, councilId)
  const [still] = await tx
    .select({ code: inviteCode.code })
    .from(inviteCode)
    .where(and(eq(inviteCode.councilId, councilId), eq(inviteCode.code, code)))
  if (!still) throw new ApiError('NOT_FOUND')
  return councilId
}

async function currentCohortId(tx: Tx, councilId: string, now: Date) {
  const [current] = await tx
    .select({ id: cohort.id })
    .from(cohort)
    .where(and(eq(cohort.councilId, councilId), cohortIsCurrent(now)))
  if (!current) throw new ApiError('NO_CURRENT_COHORT')
  return current.id
}

// 내보내졌던 사람이 돌아올 때 직급과 부서는 돌아오지 않는다: 같은 소속을 다시 열기 전에 그 기수에 끝나지 않고 남은 부서 소속을 함께 끝낸다.
async function reopenMembership(tx: Tx, membershipId: string, memberId: string, cohortId: string) {
  const open = await tx
    .select({ id: departmentMembership.id })
    .from(departmentMembership)
    .where(
      and(
        eq(departmentMembership.memberId, memberId),
        eq(departmentMembership.cohortId, cohortId),
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
      id: membershipId,
      actor: memberId,
      reason: null,
      changes: { startsAt: clockNow, endsAt: null, councilRank: null },
    },
  ]
  await updateRecords(tx, changes)
}

// 초대 링크로 들어오기(바탕 spec G3, G4): 지금 기수에 직급과 부서 없이 바로 들어온다.
// 이미 지금 소속이면 아무것도 바꾸지 않는다. 내보내졌던 사람은 같은 소속을 다시 연다.
// memberName('내 이름')은 로그인에 처음 운영진을 이을 때만 쓴다(linkMember).
export async function joinCouncil(
  tx: Tx,
  userId: string,
  { code, memberName }: JoinCouncilRequest,
  now: Date,
): Promise<string> {
  const councilId = await lockInvitedCouncil(tx, code)
  const cohortId = await currentCohortId(tx, councilId, now)
  const memberId = await linkMember(tx, userId, memberName)
  const [membership] = await tx
    .select({ id: councilMembership.id, endsAt: councilMembership.endsAt })
    .from(councilMembership)
    .where(and(eq(councilMembership.memberId, memberId), eq(councilMembership.cohortId, cohortId)))
  if (!membership) {
    await createRecord(tx, {
      kind: 'council_membership',
      councilId,
      actor: memberId,
      values: { memberId, cohortId, startsAt: clockNow },
    })
  } else if (membership.endsAt !== null) {
    await reopenMembership(tx, membership.id, memberId, cohortId)
  }
  await syncRooms(tx, { councilId, cohortId, memberId })
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
