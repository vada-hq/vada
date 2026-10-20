import { and, eq, isNull } from 'drizzle-orm'
import { koreanYearOf, type Action, type CreateCouncilRequest } from '@vada/contracts'
import { inCouncilChange } from '../../access/authorize.js'
import type { Actor } from '../../access/actor.js'
import { createCouncil } from '../../councils/service.js'
import { errorCodeOf } from '../../db/error-code.js'
import { ApiError } from '../../http/errors.js'
import { joinCouncil } from '../../invites/service.js'
import {
  accounts,
  cohort,
  councilMembership,
  inviteCode,
  memberLogin,
  users,
} from '../../db/schema.js'
import type { Db, Tx } from '../../db/types.js'
import type { SmokeConnection, SmokeSql } from './pg-smoke-connection.js'

// 점검 사례들이 함께 쓰는 틀: 판정과 연결 관리, 준비 도우미, 확인 도우미.
// 서비스 함수를 그대로 불러 쓰고, 사례마다 새 시험 사용자와 학생회를 만든다.

export type SmokeContext = {
  // 잠깐 쓸 DB에 새 연결을 연다. 준비와 확인용 하나, 동시에 움직이는 쪽마다 하나씩 따로 연다.
  connect: () => SmokeConnection
  now: Date
  // 다른 연결이 users 행을 잠근 동안 세션 행을 넣는 일이 끝나야 하는 한도(ms)
  sessionLimitMs: number
}
export type SmokeVerdict =
  { ok: true; detail: string } | { ok: false; detail: string; code: string }
export type SmokeCase = { name: string; run: (context: SmokeContext) => Promise<SmokeVerdict> }

export const pass = (detail: string): SmokeVerdict => ({ ok: true, detail })
export const fail = (detail: string, code = 'MISMATCH'): SmokeVerdict => ({
  ok: false,
  detail,
  code,
})

// 연 연결은 사례가 어떻게 끝나든 닫는다.
export async function withConnections<T>(
  context: SmokeContext,
  body: (open: () => SmokeConnection) => Promise<T>,
): Promise<T> {
  const opened: SmokeConnection[] = []
  try {
    return await body(() => {
      const connection = context.connect()
      opened.push(connection)
      return connection
    })
  } finally {
    await Promise.allSettled(opened.map(connection => connection.end()))
  }
}

// 동시에 돌린 결과 중 예상하지 못한 실패의 코드. 예상한 ApiError 코드는 거른다. 코드를 알 수 없으면 ERROR다.
export function unexpectedFailures(
  results: readonly PromiseSettledResult<unknown>[],
  expected: ReadonlySet<string>,
): string[] {
  const codes: string[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') continue
    const reason: unknown = result.reason
    if (reason instanceof ApiError && expected.has(reason.code)) continue
    codes.push(errorCodeOf(reason) || 'ERROR')
  }
  return codes
}

export const outcomeOf = (result: PromiseSettledResult<unknown>) =>
  result.status === 'fulfilled' ? 'ok' : errorCodeOf(result.reason) || 'ERROR'

// 준비 도우미 ----------------------------------------------------------------

// 시험 로그인 계정: users 행과 Google accounts 행. better-auth가 Google 로그인으로 만드는 것과 같은 칸만 채운다.
export async function googleUser(db: Db, id: string) {
  await db.insert(users).values({
    id,
    name: id,
    email: `${id}@smoke.example.test`,
    emailVerified: true,
  })
  await db
    .insert(accounts)
    .values({ id: `${id}-google`, userId: id, accountId: `sub-${id}`, providerId: 'google' })
}

function councilInput(now: Date, name: string): CreateCouncilRequest {
  const year = koreanYearOf(now)
  return {
    name,
    unit: 'department',
    schoolName: 'VADA 점검 학교',
    cohortName: year,
    startsOn: `${year}-01-01`,
    endsOn: `${year}-12-31`,
  }
}

export const createdCouncil = (db: Db, context: SmokeContext, userId: string, name: string) =>
  db.transaction(tx => createCouncil(tx, userId, councilInput(context.now, name), context.now))

export const joined = (db: Db, context: SmokeContext, userId: string, code: string) =>
  db.transaction(tx => joinCouncil(tx, userId, code, context.now))

// 학생회 행을 잠근 거래 안에서 권한을 보고 바꾼다(라우트가 쓰는 inCouncilChange 그대로).
export const changer =
  (db: Db, context: SmokeContext, who: { userId: string; councilId: string }) =>
  <T>(action: Action, run: (tx: Tx, actor: Actor) => Promise<T>) =>
    inCouncilChange(db, { ...who, action, now: context.now }, run)

export async function inviteCodeOf(db: Db, councilId: string) {
  const [row] = await db
    .select({ code: inviteCode.code })
    .from(inviteCode)
    .where(eq(inviteCode.councilId, councilId))
  if (!row) throw new Error('Invite code missing')
  return row.code
}

export async function memberIdOf(db: Db, userId: string) {
  const [row] = await db
    .select({ memberId: memberLogin.memberId })
    .from(memberLogin)
    .where(eq(memberLogin.userId, userId))
  if (!row) throw new Error('Member login missing')
  return row.memberId
}

// 확인 도우미 ----------------------------------------------------------------

// 그 계정의 그 학생회 소속 줄들(끝난 것 포함)
export const membershipsOf = (db: Db, userId: string, councilId: string) =>
  db
    .select({ endsAt: councilMembership.endsAt })
    .from(councilMembership)
    .innerJoin(memberLogin, eq(memberLogin.memberId, councilMembership.memberId))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(and(eq(memberLogin.userId, userId), eq(cohort.councilId, councilId)))

export async function presidentCount(db: Db, councilId: string) {
  const rows = await db
    .select({ id: councilMembership.id })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(
      and(
        eq(cohort.councilId, councilId),
        eq(councilMembership.councilRank, 'president'),
        isNull(councilMembership.endsAt),
      ),
    )
  return rows.length
}

export async function versionsOf(sql: SmokeSql, recordId: string) {
  const rows = await sql.unsafe(
    'SELECT upper_inf(valid) AS open, data FROM record_version WHERE record_id = $1 ORDER BY version_no',
    [recordId],
  )
  const data: unknown = rows.at(-1)?.data
  return {
    count: rows.length,
    open: rows.filter(row => row.open === true).length,
    lastOpen: rows.at(-1)?.open === true,
    last: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
  }
}
