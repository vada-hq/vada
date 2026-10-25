import { and, eq, isNull, sql } from 'drizzle-orm'
import { lockCouncil } from '../access/authorize.js'
import { cohortIsCurrent } from '../access/current-cohort.js'
import { markAgreementsWithdrawn } from '../agreement/service.js'
import { syncRooms } from '../chat/rooms.js'
import {
  accounts,
  cohort,
  councilMembership,
  department,
  departmentMembership,
  memberLogin,
  pushDevice,
  sessions,
  users,
} from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, updateRecord, updateRecords, type AnyRecordChange } from '../records/records.js'
import { currentPresidentCouncils } from '../team/service.js'

// 탈퇴(기능 021 정한 것 8, DEC-54, DEC-55, DEC-64). 앱의 탈퇴 경로와 이메일 요청 명령(privacy withdraw)이 같이 쓴다.
// 한 거래에서 차례로 한다: 소속 끝내기 → 운영진 이름·이메일 비우기(모든 판) → 동의 기록에 탈퇴한 시각 → 로그인 자료 지우기.
// 학생회 기록의 행(메시지, 업무, 지출 등)은 그대로이고, 만든 사람만 '떠난 운영진 N'으로 보인다(team/display-name.ts).

const WITHDRAWAL_REASON = '탈퇴'

const memberOf = async (db: Pick<Db, 'select'>, userId: string) =>
  (
    await db
      .select({ memberId: memberLogin.memberId })
      .from(memberLogin)
      .where(eq(memberLogin.userId, userId))
  )[0]?.memberId ?? null

// 그 운영진의 열린 학생회 소속이나 부서 소속이 있는 학생회 번호(번호 차례). 기수가 지난 소속도 넣는다.
async function openCouncilsOf(db: Pick<Db, 'select'>, memberId: string) {
  const viaMembership = await db
    .select({ councilId: cohort.councilId })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(and(eq(councilMembership.memberId, memberId), isNull(councilMembership.endsAt)))
  const viaPlacement = await db
    .select({ councilId: department.councilId })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .where(and(eq(departmentMembership.memberId, memberId), isNull(departmentMembership.endsAt)))
  return [...new Set([...viaMembership, ...viaPlacement].map(row => row.councilId))].sort()
}

// 학생회 행 잠금은 넘기기·내보내기·초대로 들어오기와 같은 잠금(lockCouncil)이다. 여러 학생회는 번호 차례로 잡아 서로 기다리다 막히지 않는다.
async function lockCouncils(tx: Tx, memberId: string, locked: Set<string>) {
  for (const councilId of await openCouncilsOf(tx, memberId)) {
    if (locked.has(councilId)) continue
    await lockCouncil(tx, councilId)
    locked.add(councilId)
  }
}

// 학생회 만들기와 초대로 들어오기는 학생회 행 다음에 계정 행을 잠근다(councils/link.ts). 같은 차례로 잡는다.
// 계정 행을 잡은 뒤 다시 보아, 그사이 들어간 학생회(이미 커밋되어 잠금이 풀렸다)도 잠근다. 계정이 없으면 이미 탈퇴했다.
async function lockAccount(tx: Tx, userId: string) {
  const locked = new Set<string>()
  const before = await memberOf(tx, userId)
  if (before) await lockCouncils(tx, before, locked)
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for('update')
  if (!user) throw new ApiError('UNAUTHENTICATED')
  const memberId = await memberOf(tx, userId)
  if (memberId) await lockCouncils(tx, memberId, locked)
  return { memberId, councilIds: [...locked] }
}

export type WithdrawalCounts = {
  councilMemberships: number
  departmentMemberships: number
  memberVersions: number
  devices: number
  sessions: number
}

const countOf = async (db: Pick<Db, 'execute'>, query: ReturnType<typeof sql>) => {
  const result = await db.execute(query)
  const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
  return Number((rows[0] as { n: number | string }).n)
}

// 탈퇴가 바꾸거나 지울 것의 개수. 미리 보기와 실제 탈퇴가 같은 셈을 쓴다. 내용과 번호는 돌려주지 않는다(DEC-56).
async function withdrawalCountsOf(
  db: Pick<Db, 'execute'>,
  userId: string,
  memberId: string | null,
): Promise<WithdrawalCounts> {
  return {
    councilMemberships: await countOf(
      db,
      sql`SELECT count(*) AS n FROM council_membership WHERE member_id = ${memberId}::uuid AND ends_at IS NULL`,
    ),
    departmentMemberships: await countOf(
      db,
      sql`SELECT count(*) AS n FROM department_membership WHERE member_id = ${memberId}::uuid AND ends_at IS NULL`,
    ),
    memberVersions: await countOf(
      db,
      sql`SELECT count(*) AS n FROM record_version WHERE record_id = ${memberId}::uuid`,
    ),
    devices: await countOf(
      db,
      sql`SELECT count(*) AS n FROM push_device WHERE user_id = ${userId}`,
    ),
    sessions: await countOf(db, sql`SELECT count(*) AS n FROM sessions WHERE user_id = ${userId}`),
  }
}

// ① 열린 학생회 소속과 부서 소속을 끝낸다(판 사유 '탈퇴', 바꾼 사람 본인). 지금 기수의 회장이 아님은 이미 보았으므로,
// 남은 회장 소속은 넘길 수 없는 지난 기수의 것이라 회장이 없어져도 된다. 그다음 편성 방의 참여 줄을 내보낼 때와 같은 도우미로 맞춘다.
async function endMemberships(tx: Tx, memberId: string, councilIds: string[], now: Date) {
  const placements = await tx
    .select({ id: departmentMembership.id })
    .from(departmentMembership)
    .where(and(eq(departmentMembership.memberId, memberId), isNull(departmentMembership.endsAt)))
  const memberships = await tx
    .select({
      id: councilMembership.id,
      cohortId: councilMembership.cohortId,
      rank: councilMembership.councilRank,
    })
    .from(councilMembership)
    .where(and(eq(councilMembership.memberId, memberId), isNull(councilMembership.endsAt)))
  const ending = { actor: memberId, reason: WITHDRAWAL_REASON, changes: { endsAt: clockNow } }
  const changes: AnyRecordChange[] = [
    ...placements.map(item => ({ kind: 'department_membership' as const, id: item.id, ...ending })),
    ...memberships.map(item => ({ kind: 'council_membership' as const, id: item.id, ...ending })),
  ]
  const pastPresidencies = memberships
    .filter(item => item.rank === 'president')
    .map(i => i.cohortId)
  await updateRecords(tx, changes, new Set(pastPresidencies))
  for (const councilId of councilIds) {
    const [current] = await tx
      .select({ id: cohort.id })
      .from(cohort)
      .where(and(eq(cohort.councilId, councilId), cohortIsCurrent(now)))
    if (current) await syncRooms(tx, { councilId, cohortId: current.id, memberId })
  }
}

// ② 탈퇴한 시각을 넣고 이름·이메일을 비운 새 판을 남긴 뒤, 모든 이전 판에서도 비운다(DEC-54, registrations/personal-values.ts와 같은 방식).
async function clearMember(tx: Tx, memberId: string) {
  await updateRecord(tx, {
    kind: 'member',
    id: memberId,
    actor: memberId,
    reason: WITHDRAWAL_REASON,
    changes: { leftAt: clockNow, name: null, email: null },
  })
  await tx.execute(sql`UPDATE record_version SET data = data || '{"name": null, "email": null}'::jsonb
    WHERE record_id = ${memberId} AND (data ->> 'name' IS NOT NULL OR data ->> 'email' IS NOT NULL)`)
}

// ④ 로그인 자료. users를 지우면 세션·계정·잇기·기기는 외래 키로 함께 지워지지만, 지우는 것을 여기에 다 적는다.
async function deleteLogin(tx: Tx, userId: string) {
  await tx.delete(memberLogin).where(eq(memberLogin.userId, userId))
  await tx.delete(pushDevice).where(eq(pushDevice.userId, userId))
  await tx.delete(sessions).where(eq(sessions.userId, userId))
  await tx.delete(accounts).where(eq(accounts.userId, userId))
  await tx.delete(users).where(eq(users.id, userId))
}

// 탈퇴 한 건. 학생회 행과 계정 행을 잠근 뒤 회장인지 보므로, 넘기기와 겹쳐도 회장 없는 학생회가 생기지 않는다.
// 어느 학생회든 지금 기수의 회장이면 아무것도 바꾸지 않고 409다. 바꾸거나 지운 것의 개수를 돌려준다.
export async function withdrawAccount(
  tx: Tx,
  userId: string,
  now: Date,
): Promise<WithdrawalCounts> {
  const { memberId, councilIds } = await lockAccount(tx, userId)
  if (memberId && (await currentPresidentCouncils(tx, memberId, now)).length > 0)
    throw new ApiError('PRESIDENT_CANNOT_WITHDRAW')
  const counts = await withdrawalCountsOf(tx, userId, memberId)
  if (memberId) {
    await endMemberships(tx, memberId, councilIds, now)
    await clearMember(tx, memberId)
  }
  await markAgreementsWithdrawn(tx, userId)
  await deleteLogin(tx, userId)
  return counts
}

// 가입 이메일로 찾은 계정(이메일 요청 명령). better-auth는 이메일을 소문자로 둔다.
export async function userIdByEmail(db: Pick<Db, 'select'>, email: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
  return user?.id ?? null
}

// 미리 보기: 아무것도 잠그거나 바꾸지 않고, 막히는지와 개수만 본다.
export async function previewWithdrawal(db: Db, userId: string, now: Date) {
  const memberId = await memberOf(db, userId)
  const president = memberId
    ? (await currentPresidentCouncils(db, memberId, now)).length > 0
    : false
  return { president, counts: await withdrawalCountsOf(db, userId, memberId) }
}
