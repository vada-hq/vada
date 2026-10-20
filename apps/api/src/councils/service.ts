import { eq } from 'drizzle-orm'
import type {
  CreateCouncilRequest,
  UpdateCohortRequest,
  UpdateCouncilSettingsRequest,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { periodIsCurrent } from '../access/current-cohort.js'
import { cohort, council, inviteCode } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { freshInviteCode } from '../invites/code.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import type { Tx } from '../db/types.js'
import { linkMember } from './link.js'

// 학생회를 만들면 함께 생기는 재정 역할 부서(DEC-16). 이름은 나중에 바꿀 수 있다.
export const FINANCE_DEPARTMENT_NAME = '재정부'

// 기수의 기간이 오늘(한국 날짜)을 담아야 운영진에게 지금 소속이 생긴다. 담지 않으면 아무도 학생회를 열 수 없다.
export function assertCurrentPeriod(period: { startsOn: string; endsOn: string }, now: Date) {
  if (!periodIsCurrent(period, now)) throw new ApiError('COHORT_NOT_CURRENT')
}

// 학생회 만들기는 한 거래다(바탕 spec G6): 운영진(없으면)과 로그인 잇기, 학생회, 첫 기수, 회장 소속, 재정부, 초대 코드.
// 감사기구와 의결기구는 만들지 않는다. 학생회 번호를 돌려준다.
export async function createCouncil(
  tx: Tx,
  userId: string,
  input: CreateCouncilRequest,
  now: Date,
): Promise<string> {
  assertCurrentPeriod(input, now)
  const actor = await linkMember(tx, userId)
  const councilId = await createRecord(tx, {
    kind: 'council',
    councilId: null,
    actor,
    values: { name: input.name, unit: input.unit, schoolName: input.schoolName },
  })
  const cohortId = await createRecord(tx, {
    kind: 'cohort',
    councilId,
    actor,
    values: { name: input.cohortName, startsOn: input.startsOn, endsOn: input.endsOn },
  })
  await createRecord(tx, {
    kind: 'council_membership',
    councilId,
    actor,
    values: { memberId: actor, cohortId, councilRank: 'president', startsAt: clockNow },
  })
  await createRecord(tx, {
    kind: 'department',
    councilId,
    actor,
    values: { name: FINANCE_DEPARTMENT_NAME, role: 'finance' },
  })
  await tx
    .insert(inviteCode)
    .values({ councilId, code: await freshInviteCode(tx), createdBy: actor })
  return councilId
}

// 학생회 정보와 직급 표시 이름 고치기. 바뀐 것이 없으면 판을 만들지 않는다.
export async function updateSettings(tx: Tx, actor: Actor, input: UpdateCouncilSettingsRequest) {
  const changes = {
    name: input.name,
    unit: input.unit,
    schoolName: input.schoolName,
    presidentTitle: input.titles.president,
    vicePresidentTitle: input.titles.vicePresident,
    headTitle: input.titles.head,
    viceHeadTitle: input.titles.viceHead,
  }
  const [current] = await tx.select().from(council).where(eq(council.id, actor.councilId))
  if (!current) throw new ApiError('NOT_FOUND')
  if (
    (Object.keys(changes) as (keyof typeof changes)[]).every(key => current[key] === changes[key])
  )
    return
  await updateRecord(tx, {
    kind: 'council',
    id: actor.councilId,
    actor: actor.memberId,
    reason: null,
    changes,
  })
}

// 지금 기수의 이름과 기간 고치기. 기간이 오늘을 담지 않으면 모두 학생회를 열 수 없게 되므로 409로 막는다.
export async function updateCohort(tx: Tx, actor: Actor, input: UpdateCohortRequest, now: Date) {
  assertCurrentPeriod(input, now)
  const [current] = await tx
    .select({ name: cohort.name, startsOn: cohort.startsOn, endsOn: cohort.endsOn })
    .from(cohort)
    .where(eq(cohort.id, actor.cohortId))
  if (
    current?.name === input.name &&
    current.startsOn === input.startsOn &&
    current.endsOn === input.endsOn
  )
    return
  await updateRecord(tx, {
    kind: 'cohort',
    id: actor.cohortId,
    actor: actor.memberId,
    reason: null,
    changes: { name: input.name, startsOn: input.startsOn, endsOn: input.endsOn },
  })
}
