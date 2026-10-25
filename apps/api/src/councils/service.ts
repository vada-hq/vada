import { and, eq, gte, lte, ne } from 'drizzle-orm'
import {
  DEFAULT_FINANCE_DEPARTMENT_NAME,
  koreanDateOf,
  koreanYearOf,
  operatingYearsOf,
} from '@vada/contracts'
import type {
  CreateCouncilRequest,
  UpdateCohortRequest,
  UpdateCouncilSettingsRequest,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { periodHasStarted } from '../access/current-cohort.js'
import { cohort, council, inviteCode } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { syncRooms } from '../chat/rooms.js'
import { freshInviteCode } from '../invites/code.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import type { Tx } from '../db/types.js'
import { linkMember } from './link.js'

// 기수가 시작해야(시작일이 오늘 이전) 운영진에게 지금 소속이 생긴다(DEC-57). 시작 전이면 아무도 학생회를 열 수 없다.
// 끝 날짜는 보지 않는다: 끝 날짜가 지난 기수도 다음 기수가 시작하기 전까지 지금 기수다.
function assertStarted(period: { startsOn: string }, now: Date) {
  if (!periodHasStarted(period, now)) throw new ApiError('COHORT_NOT_STARTED')
}

// 운영 연도의 첫 기수(DEC-87): 이름 '{Y}', Y-01-01~Y-12-31. 내년은 오늘 시작한다. 시작일이 오늘보다 뒤면 지금 기수가 없어
// 아무도 학생회를 열지 못하기 때문이다. 선택지(작년·올해·내년)는 계약이 아니라 오늘에 기대므로 여기서 본다.
function firstCohortOf(year: number, now: Date) {
  if (!operatingYearsOf(now).includes(year)) throw new ApiError('INVALID_INPUT')
  const startsOn = String(year) > koreanYearOf(now) ? koreanDateOf(now) : `${year}-01-01`
  return { name: String(year), startsOn, endsOn: `${year}-12-31` }
}

// 처음 부서 목록: 재정 역할 부서 하나와 역할 없는 부서들. 이름이 겹치지 않는 것은 계약이 본다.
// 부서방은 만들지 않는다: 부서방은 운영진이 있는 부서마다 생긴다(RULE-28, syncRooms).
async function createInitialDepartments(
  tx: Tx,
  { councilId, actor }: { councilId: string; actor: string },
  input: Pick<CreateCouncilRequest, 'financeDepartmentName' | 'departments'>,
) {
  const finance = input.financeDepartmentName ?? DEFAULT_FINANCE_DEPARTMENT_NAME
  await createRecord(tx, {
    kind: 'department',
    councilId,
    actor,
    values: { name: finance, role: 'finance' },
  })
  for (const name of input.departments ?? [])
    await createRecord(tx, { kind: 'department', councilId, actor, values: { name } })
}

// 학생회 만들기는 한 거래다(바탕 spec G6): 운영진(없으면)과 로그인 잇기, 학생회, 첫 기수, 회장 소속, 처음 부서 목록, 초대 코드.
// 감사기구와 의결기구는 만들지 않는다. 학생회 번호를 돌려준다.
export async function createCouncil(
  tx: Tx,
  userId: string,
  input: CreateCouncilRequest,
  now: Date,
): Promise<string> {
  const term = firstCohortOf(input.year, now)
  const actor = await linkMember(tx, userId, input.memberName)
  const councilId = await createRecord(tx, {
    kind: 'council',
    councilId: null,
    actor,
    values: { name: input.name, unit: input.unit, schoolName: input.schoolName },
  })
  const cohortId = await createRecord(tx, { kind: 'cohort', councilId, actor, values: term })
  await createRecord(tx, {
    kind: 'council_membership',
    councilId,
    actor,
    values: { memberId: actor, cohortId, councilRank: 'president', startsAt: clockNow },
  })
  await createInitialDepartments(tx, { councilId, actor }, input)
  await tx
    .insert(inviteCode)
    .values({ councilId, code: await freshInviteCode(tx), createdBy: actor })
  await syncRooms(tx, { councilId, cohortId, memberId: actor })
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

// 고친 기수가 여전히 가장 늦게 시작한 기수인가. 이미 시작한 다른 기수보다 시작일을 앞으로 옮기면 기간이 겹치지 않아도(EXCLUDE)
// 그 기수가 지금 기수가 되어 지난 기수 소속에 권한이 되살아난다. 학생회 행을 잠근 거래(inCouncilChange) 안에서 부른다.
async function assertStillLatest(tx: Tx, actor: Actor, startsOn: string, now: Date) {
  const [overtaken] = await tx
    .select({ id: cohort.id })
    .from(cohort)
    .where(
      and(
        eq(cohort.councilId, actor.councilId),
        ne(cohort.id, actor.cohortId),
        gte(cohort.startsOn, startsOn),
        lte(cohort.startsOn, koreanDateOf(now)),
      ),
    )
    .limit(1)
  if (overtaken) throw new ApiError('COHORT_NOT_LATEST')
}

// 지금 기수의 이름과 기간 고치기. 고친 뒤에도 지금 기수여야 한다: 시작일을 오늘 뒤로 옮기면 모두 학생회를 열 수 없고,
// 이미 시작한 다른 기수보다 앞으로 옮기면 지난 기수가 지금 기수가 되므로 둘 다 409로 막는다.
export async function updateCohort(tx: Tx, actor: Actor, input: UpdateCohortRequest, now: Date) {
  assertStarted(input, now)
  await assertStillLatest(tx, actor, input.startsOn, now)
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
