import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { DAY_MS, dateFromKorean, type CouncilRank } from '@vada/contracts'
import { lockCouncil } from '../src/access/authorize.js'
import { cohortIsCurrent } from '../src/access/current-cohort.js'
import { syncRooms } from '../src/chat/rooms.js'
import { cohort, council, councilMembership, memberLogin, users } from '../src/db/schema.js'
import type { Db } from '../src/db/types.js'
import { memberNamesOf } from '../src/team/display-name.js'
import { handOverPresident } from '../src/team/service.js'

// 회장 되찾기(DEC-57): 회장이 연락이 끊겼을 때 VADA가 회장 직급을 지금 기수의 다른 운영진에게 옮긴다.
// 회장단의 요청이나 공식 문서, 옮긴 근거는 절차 문서(vada-docs pilot/)가 정한 곳에 남기고 여기에는 넣지 않는다.
// 사람의 요청이 아니라서 판의 바꾼 사람은 비우고 사유 칸에 이 코드를 남긴다(업무가 저절로 바뀔 때와 같은 방식, DEC-82).
export const PRESIDENT_RECOVERY_REASON = 'president_recovery'

// 이의 기간(DEC-57 '지금 회장에게 알리고 7일 동안 이의를 받는다'). 알린 날은 세지 않고 다음 날부터 7일,
// 7일째 24:00(한국)에 끝난다(민법 제157조 초일 불산입, 제159조 말일 종료). 알린 날 + 8일의 0시(한국)다.
const OBJECTION_DAYS = 7
export const objectionEndsAt = (notifiedOn: string) =>
  new Date(dateFromKorean(`${notifiedOn}T00:00`).getTime() + (OBJECTION_DAYS + 1) * DAY_MS)

export type RecoveryProblem =
  | 'NO_COUNCIL'
  | 'NO_COHORT'
  | 'NO_PRESIDENT'
  | 'NO_ACCOUNT'
  | 'NOT_MEMBER'
  | 'ALREADY_PRESIDENT'
  | 'TOO_EARLY'
type Person = { memberId: string; name: string }
// 보이는 것: 학생회 이름, 지금 회장, 새 회장, 점검에 걸린 것. 걸린 것이 없을 때만 옮긴다.
export type RecoveryView = {
  councilName: string | null
  current: Person | null
  next: Person | null
  problems: RecoveryProblem[]
}
export type RecoveryInput = { councilId: string; email: string; notifiedOn: string; now: Date }

type Reader = Pick<Db, 'select'>
type Seat = { memberId: string; membershipId: string; councilRank: CouncilRank | null }
type HandOver = { cohortId: string; from: string; to: string }

async function currentCohortOf(reader: Reader, councilId: string, now: Date) {
  const [row] = await reader
    .select({ id: cohort.id })
    .from(cohort)
    .where(and(eq(cohort.councilId, councilId), cohortIsCurrent(now)))
  return row?.id
}

// 지금 기수의 끝나지 않은 회장 소속
async function presidentOf(reader: Reader, cohortId: string): Promise<Seat | undefined> {
  const [row] = await reader
    .select({
      memberId: councilMembership.memberId,
      membershipId: councilMembership.id,
      councilRank: councilMembership.councilRank,
    })
    .from(councilMembership)
    .where(
      and(
        eq(councilMembership.cohortId, cohortId),
        eq(councilMembership.councilRank, 'president'),
        isNull(councilMembership.endsAt),
      ),
    )
  return row
}

// 이메일의 로그인 계정이 지금 기수에 끝나지 않은 소속을 가졌는가. 다른 학생회 사람과 내보낸 사람은 소속이 없다.
// 이메일은 대소문자를 가리지 않는다(Google 계정 이메일).
async function seatOfEmail(
  reader: Reader,
  cohortId: string,
  email: string,
): Promise<Seat | 'NO_ACCOUNT' | 'NOT_MEMBER'> {
  const accounts = await reader
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
  if (!accounts.length) return 'NO_ACCOUNT'
  const seats = await reader
    .select({
      memberId: councilMembership.memberId,
      membershipId: councilMembership.id,
      councilRank: councilMembership.councilRank,
    })
    .from(councilMembership)
    .innerJoin(memberLogin, eq(memberLogin.memberId, councilMembership.memberId))
    .where(
      and(
        inArray(
          memberLogin.userId,
          accounts.map(account => account.id),
        ),
        eq(councilMembership.cohortId, cohortId),
        isNull(councilMembership.endsAt),
      ),
    )
  return seats.length === 1 ? seats[0]! : 'NOT_MEMBER'
}

function problemsOf(
  president: Seat | undefined,
  seat: Seat | 'NO_ACCOUNT' | 'NOT_MEMBER',
  input: RecoveryInput,
) {
  const problems: RecoveryProblem[] = []
  if (!president) problems.push('NO_PRESIDENT')
  if (typeof seat === 'string') problems.push(seat)
  else if (seat.councilRank === 'president') problems.push('ALREADY_PRESIDENT')
  if (input.now < objectionEndsAt(input.notifiedOn)) problems.push('TOO_EARLY')
  return problems
}

const stopped = (councilName: string | null, problem: RecoveryProblem) => ({
  view: { councilName, current: null, next: null, problems: [problem] },
  handOver: null,
})

async function inspect(
  reader: Reader,
  input: RecoveryInput,
): Promise<{ view: RecoveryView; handOver: HandOver | null }> {
  const [found] = await reader
    .select({ name: council.name })
    .from(council)
    .where(eq(council.id, input.councilId))
  if (!found) return stopped(null, 'NO_COUNCIL')
  const cohortId = await currentCohortOf(reader, input.councilId, input.now)
  if (!cohortId) return stopped(found.name, 'NO_COHORT')
  const president = await presidentOf(reader, cohortId)
  const seat = await seatOfEmail(reader, cohortId, input.email)
  const next = typeof seat === 'string' ? undefined : seat
  const names = await memberNamesOf(
    reader,
    input.councilId,
    [president, next].flatMap(item => (item ? [item.memberId] : [])),
  )
  const personOf = (item: Seat | undefined) =>
    item ? { memberId: item.memberId, name: names.get(item.memberId) ?? '' } : null
  const problems = problemsOf(president, seat, input)
  const view = {
    councilName: found.name,
    current: personOf(president),
    next: personOf(next),
    problems,
  }
  const handOver =
    president && next && !problems.length
      ? { cohortId, from: president.membershipId, to: next.membershipId }
      : null
  return { view, handOver }
}

// 미리 보기: 읽기만 한다.
export const inspectRecovery = async (reader: Reader, input: RecoveryInput) =>
  (await inspect(reader, input)).view

// 적용: 학생회 행을 잠근 거래에서 다시 점검하고, 걸린 것이 없을 때만 옮긴 뒤 방 참여를 맞춘다(DEC-18).
// 회장 넘기기와 같은 순서(handOverPresident)라 회장 한 명 규칙과 판이 지켜진다. 걸리면 아무것도 쓰지 않는다.
export function recoverPresident(db: Db, input: RecoveryInput): Promise<RecoveryView> {
  return db.transaction(async tx => {
    await lockCouncil(tx, input.councilId)
    const { view, handOver } = await inspect(tx, input)
    if (!handOver) return view
    await handOverPresident(tx, {
      from: handOver.from,
      to: handOver.to,
      actor: null,
      reason: PRESIDENT_RECOVERY_REASON,
    })
    await syncRooms(tx, { councilId: input.councilId, cohortId: handOver.cohortId, memberId: null })
    return view
  })
}
