import { and, asc, eq, inArray } from 'drizzle-orm'
import { currentCouncilMembership } from '../access/current-cohort.js'
import { cohort, councilMembership } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'

// 이 중 지금 이 학생회의 운영진인 사람. 1:1의 참여 줄은 학생회를 떠난 뒤에도 남고 기록 모듈은 끝난 소속에게도 알림 기록을 허용하므로,
// 상대가 지금도 운영진인지는 참여 줄과 따로 여기서 본다.
export async function currentMembersAmong(
  db: Pick<Db, 'select'>,
  councilId: string,
  memberIds: readonly string[],
  now: Date,
) {
  if (!memberIds.length) return new Set<string>()
  const rows = await db
    .select({ memberId: councilMembership.memberId })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(
      and(
        eq(cohort.councilId, councilId),
        inArray(councilMembership.memberId, [...memberIds]),
        currentCouncilMembership(now),
      ),
    )
  return new Set(rows.map(row => row.memberId))
}

// 요청한 사람·먼저 낸 사람·부탁한 사람은 지금 이 학생회의 운영진이어야 한다. 기록 모듈은 떠난 운영진도 허용하므로 여기서 따로 본다.
export async function assertCurrentMembers(
  db: Pick<Db, 'select'>,
  councilId: string,
  ids: (string | null)[],
  now: Date,
) {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))]
  const alive = await currentMembersAmong(db, councilId, wanted, now)
  if (wanted.some(id => !alive.has(id))) throw new ApiError('MEMBER_INVALID')
}

// currentMembersAmong과 같되 소속 줄을 FOR SHARE로 잠근다. 내보내기는 소속 줄을 바꾸므로(FOR NO KEY UPDATE) 이 거래가 끝나기를 기다리고,
// 먼저 내보내졌다면 잠금을 기다린 뒤의 값을 다시 읽어 그 사람이 빠진다(READ COMMITTED). 방 참여 줄이 남는 1:1의 보내기가 쓴다.
// 줄 번호 순으로 잠가 서로 다른 순서로 잠그는 거래끼리 교착하지 않게 한다. 읽기만 하므로 공유 잠금끼리 업그레이드 교착도 없다.
export async function lockCurrentMembers(
  tx: Tx,
  councilId: string,
  memberIds: readonly string[],
  now: Date,
) {
  const rows = await tx
    .select({ memberId: councilMembership.memberId })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(
      and(
        eq(cohort.councilId, councilId),
        inArray(councilMembership.memberId, [...memberIds]),
        currentCouncilMembership(now),
      ),
    )
    .orderBy(asc(councilMembership.id))
    .for('share', { of: councilMembership })
  return new Set(rows.map(row => row.memberId))
}
