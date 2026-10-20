import { and, eq, isNull } from 'drizzle-orm'
import {
  koreanYearOf,
  type Action,
  type CreateCouncilRequest,
  type UpdateCouncilSettingsRequest,
} from '@vada/contracts'
import { inCouncilChange } from '../access/authorize.js'
import type { Actor } from '../access/actor.js'
import { createCouncil, updateSettings } from '../councils/service.js'
import { ApiError } from '../http/errors.js'
import { invitedCouncil, joinCouncil, rotateInviteCode } from '../invites/service.js'
import {
  assignDepartment,
  changeRank,
  createDepartment,
  removeMember,
  transferPresident,
  updateDepartment,
} from '../team/service.js'
import { errorCodeOf } from './error-code.js'
import type { SmokeConnection, SmokeSql } from './pg-smoke-connection.js'
import {
  accounts,
  cohort,
  councilMembership,
  department,
  departmentMembership,
  inviteCode,
  memberLogin,
  sessions,
  users,
} from './schema.js'
import type { Db, Tx } from './types.js'

// 실제 PostgreSQL에서 돌리는 점검 사례. 서비스 함수를 그대로 불러 쓰고, 사례마다 새 시험 사용자와 학생회를 만든다.
// 동시에 움직이는 쪽은 연결을 따로 열어(ctx.connect) Promise.allSettled로 함께 시작한다. PGlite는 거래를 하나씩 돌리므로
// 이 사례들의 동시성은 PGlite로 증명하지 못한다. 시험은 사례의 준비와 판정이 맞는지만 본다(pg-smoke-cases.test.ts).

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

const pass = (detail: string): SmokeVerdict => ({ ok: true, detail })
const fail = (detail: string, code = 'MISMATCH'): SmokeVerdict => ({ ok: false, detail, code })

// 연 연결은 사례가 어떻게 끝나든 닫는다.
async function withConnections<T>(
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

const outcomeOf = (result: PromiseSettledResult<unknown>) =>
  result.status === 'fulfilled' ? 'ok' : errorCodeOf(result.reason) || 'ERROR'

// 준비 도우미 ----------------------------------------------------------------

// 시험 로그인 계정: users 행과 Google accounts 행. better-auth가 Google 로그인으로 만드는 것과 같은 칸만 채운다.
async function googleUser(db: Db, id: string) {
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

const ONE_HOUR_MS = 3_600_000

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

const createdCouncil = (db: Db, context: SmokeContext, userId: string, name: string) =>
  db.transaction(tx => createCouncil(tx, userId, councilInput(context.now, name), context.now))

const joined = (db: Db, context: SmokeContext, userId: string, code: string) =>
  db.transaction(tx => joinCouncil(tx, userId, code, context.now))

// 학생회 행을 잠근 거래 안에서 권한을 보고 바꾼다(라우트가 쓰는 inCouncilChange 그대로).
const changed = <T>(
  db: Db,
  context: SmokeContext,
  userId: string,
  councilId: string,
  action: Action,
  run: (tx: Tx, actor: Actor) => Promise<T>,
) => inCouncilChange(db, userId, councilId, action, context.now, run)

async function inviteCodeOf(db: Db, councilId: string) {
  const [row] = await db
    .select({ code: inviteCode.code })
    .from(inviteCode)
    .where(eq(inviteCode.councilId, councilId))
  if (!row) throw new Error('Invite code missing')
  return row.code
}

async function memberIdOf(db: Db, userId: string) {
  const [row] = await db
    .select({ memberId: memberLogin.memberId })
    .from(memberLogin)
    .where(eq(memberLogin.userId, userId))
  if (!row) throw new Error('Member login missing')
  return row.memberId
}

// 확인 도우미 ----------------------------------------------------------------

// 그 계정의 그 학생회 소속 줄들(끝난 것 포함)
const membershipsOf = (db: Db, userId: string, councilId: string) =>
  db
    .select({ endsAt: councilMembership.endsAt })
    .from(councilMembership)
    .innerJoin(memberLogin, eq(memberLogin.memberId, councilMembership.memberId))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(and(eq(memberLogin.userId, userId), eq(cohort.councilId, councilId)))

async function presidentCount(db: Db, councilId: string) {
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

async function versionsOf(sql: SmokeSql, recordId: string) {
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

// 사례 1: 쓰기 길 -------------------------------------------------------------

const WRITE_SETTINGS: UpdateCouncilSettingsRequest = {
  name: '점검 학생회(고침)',
  unit: 'college',
  schoolName: 'VADA 점검 학교',
  titles: { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' },
}

const W = { president: 'smoke-w-president', member: 'smoke-w-member' }

export const writePathCase: SmokeCase = {
  name: '쓰기 길(학생회 만들기, 부서 만들기, 이름 바꾸기, 부서 배정, 학생회 정보 저장)',
  run: context =>
    withConnections(context, async open => {
      const { db, sql } = open()
      await googleUser(db, W.president)
      await googleUser(db, W.member)
      const councilId = await createdCouncil(db, context, W.president, '점검 학생회')
      const change = <T>(action: Action, run: (tx: Tx, actor: Actor) => Promise<T>) =>
        changed(db, context, W.president, councilId, action, run)
      await change('department.manage', (tx, actor) => createDepartment(tx, actor, '기획부'))
      const [planning] = await db
        .select({ id: department.id })
        .from(department)
        .where(and(eq(department.councilId, councilId), eq(department.name, '기획부')))
      if (!planning) throw new Error('Department missing')
      await change('department.manage', (tx, actor) =>
        updateDepartment(tx, actor, planning.id, { name: '기획국', role: null }),
      )
      await joined(db, context, W.member, await inviteCodeOf(db, councilId))
      const memberId = await memberIdOf(db, W.member)
      await change('member.manage', (tx, actor) =>
        assignDepartment(tx, actor, memberId, planning.id, null),
      )
      await change('council.update', (tx, actor) => updateSettings(tx, actor, WRITE_SETTINGS))
      const [placement] = await db
        .select({ id: departmentMembership.id })
        .from(departmentMembership)
        .where(
          and(
            eq(departmentMembership.memberId, memberId),
            eq(departmentMembership.departmentId, planning.id),
          ),
        )
      if (!placement) throw new Error('Placement missing')

      // 기록마다 판 수(만들기 1 + 바꾼 횟수), 열린 판 하나(마지막), 마지막 판의 값을 본다.
      const checks = [
        {
          label: '학생회',
          id: councilId,
          count: 2,
          values: { name: WRITE_SETTINGS.name, president_title: WRITE_SETTINGS.titles.president },
        },
        { label: '부서', id: planning.id, count: 2, values: { name: '기획국' } },
        {
          label: '부서 소속',
          id: placement.id,
          count: 1,
          values: { department_id: planning.id, ends_at: null },
        },
      ]
      const problems: string[] = []
      const counts: string[] = []
      for (const check of checks) {
        const versions = await versionsOf(sql, check.id)
        counts.push(`${check.label} ${versions.count}`)
        if (versions.count !== check.count)
          problems.push(`${check.label} 판 ${versions.count}개(기대 ${check.count})`)
        if (versions.open !== 1 || !versions.lastOpen)
          problems.push(`${check.label} 열린 판이 마지막 하나가 아님`)
        for (const [key, value] of Object.entries(check.values))
          if (versions.last[key] !== value)
            problems.push(`${check.label} 마지막 판의 ${key} 불일치`)
      }
      return problems.length > 0
        ? fail(problems.join(', '))
        : pass(`판 수 ${counts.join(', ')}, 마지막 판의 값이 기대와 같다`)
    }),
}

// 사례 a: 같은 계정이 같은 코드로 동시에 두 번 들어오기 --------------------------------

const A = { host: 'smoke-a-host', guest: 'smoke-a-guest' }

export const joinTwiceCase: SmokeCase = {
  name: '같은 계정이 같은 초대 코드로 동시에 두 번 들어오기',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, A.host)
      await googleUser(main.db, A.guest)
      const councilId = await createdCouncil(main.db, context, A.host, '점검 a 학생회')
      const code = await inviteCodeOf(main.db, councilId)
      const [left, right] = [open(), open()]
      const results = await Promise.allSettled([
        joined(left.db, context, A.guest, code),
        joined(right.db, context, A.guest, code),
      ])
      const bad = unexpectedFailures(results, new Set())
      if (bad.length > 0) return fail('들어오다 예상하지 못한 오류', bad[0])
      const rows = await membershipsOf(main.db, A.guest, councilId)
      const openRows = rows.filter(row => row.endsAt === null).length
      return rows.length === 1 && openRows === 1
        ? pass('열린 학생회 소속 1개')
        : fail(`소속 ${rows.length}개, 그중 열린 것 ${openRows}개`)
    }),
}

// 사례 b: 회장단 둘이 동시에 초대 코드 바꾸기 ----------------------------------------

const B = { president: 'smoke-b-president', vice: 'smoke-b-vice', guest: 'smoke-b-guest' }

export const rotateTogetherCase: SmokeCase = {
  name: '회장단 둘이 동시에 초대 코드 바꾸기',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      for (const user of Object.values(B)) await googleUser(main.db, user)
      const councilId = await createdCouncil(main.db, context, B.president, '점검 b 학생회')
      await joined(main.db, context, B.vice, await inviteCodeOf(main.db, councilId))
      const viceMember = await memberIdOf(main.db, B.vice)
      await changed(main.db, context, B.president, councilId, 'rank.manage', (tx, actor) =>
        changeRank(tx, actor, viceMember, 'vice_president'),
      )
      const [left, right] = [open(), open()]
      const results = await Promise.allSettled([
        changed(left.db, context, B.president, councilId, 'invite.manage', rotateInviteCode),
        changed(right.db, context, B.vice, councilId, 'invite.manage', rotateInviteCode),
      ])
      const bad = unexpectedFailures(results, new Set())
      if (bad.length > 0) return fail('코드를 바꾸다 예상하지 못한 오류', bad[0])
      const rows = await main.db
        .select({ code: inviteCode.code })
        .from(inviteCode)
        .where(eq(inviteCode.councilId, councilId))
      const returned = results.flatMap(result =>
        result.status === 'fulfilled' ? [result.value] : [],
      )
      if (rows.length !== 1) return fail(`코드가 ${rows.length}개 남았다`)
      const stored = rows[0]!.code
      if (!returned.includes(stored)) return fail('남은 코드가 둘이 돌려받은 코드 중 하나가 아니다')
      // 쓸 수 있는 코드인지: 그 코드로 학생회가 찾아지고 새 사람이 들어와진다.
      const found = await invitedCouncil(main.db, stored)
      if (found.id !== councilId) return fail('남은 코드가 다른 학생회를 가리킨다')
      await joined(main.db, context, B.guest, stored)
      return pass('둘 다 끝났고 코드 1개가 남아 그 코드로 들어와진다')
    }),
}

// 사례 c: 회장 넘기기와 그 사람 내보내기를 동시에 ------------------------------------

// 넘기기가 먼저면 내보내기는 회장을 내보내려 해서 PRESIDENT_CANNOT_LEAVE, 내보내기가 먼저면 넘기기는 없는 소속이라 NOT_FOUND다.
const TRANSFER_REMOVE_EXPECTED = new Set(['PRESIDENT_CANNOT_LEAVE', 'NOT_FOUND'])

const C = { president: 'smoke-c-president', vice: 'smoke-c-vice', target: 'smoke-c-target' }

export const transferAndRemoveCase: SmokeCase = {
  name: '회장 넘기기와 그 사람 내보내기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      for (const user of Object.values(C)) await googleUser(main.db, user)
      const councilId = await createdCouncil(main.db, context, C.president, '점검 c 학생회')
      const code = await inviteCodeOf(main.db, councilId)
      await joined(main.db, context, C.vice, code)
      await joined(main.db, context, C.target, code)
      const viceMember = await memberIdOf(main.db, C.vice)
      const targetMember = await memberIdOf(main.db, C.target)
      await changed(main.db, context, C.president, councilId, 'rank.manage', (tx, actor) =>
        changeRank(tx, actor, viceMember, 'vice_president'),
      )
      const [left, right] = [open(), open()]
      const results = await Promise.allSettled([
        changed(left.db, context, C.president, councilId, 'president.transfer', (tx, actor) =>
          transferPresident(tx, actor, targetMember),
        ),
        changed(right.db, context, C.vice, councilId, 'member.manage', (tx, actor) =>
          removeMember(tx, actor, targetMember),
        ),
      ])
      const bad = unexpectedFailures(results, TRANSFER_REMOVE_EXPECTED)
      if (bad.length > 0) return fail('넘기기나 내보내기가 예상하지 못한 오류로 끝났다', bad[0])
      const [transfer, remove] = results.map(outcomeOf)
      if (results.filter(result => result.status === 'fulfilled').length !== 1)
        return fail(`둘 중 하나만 끝나야 한다(넘기기 ${transfer}, 내보내기 ${remove})`)
      const presidents = await presidentCount(main.db, councilId)
      return presidents === 1
        ? pass(`회장 1명, 넘기기 ${transfer}, 내보내기 ${remove}`)
        : fail(`회장이 ${presidents}명이다(넘기기 ${transfer}, 내보내기 ${remove})`)
    }),
}

// 사례 d: 새 계정이 학생회 만들기와 들어오기를 동시에 -----------------------------------

const D = { host: 'smoke-d-host', newcomer: 'smoke-d-newcomer' }

export const createAndJoinCase: SmokeCase = {
  name: '새 계정이 학생회 만들기와 들어오기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, D.host)
      await googleUser(main.db, D.newcomer)
      const hostCouncil = await createdCouncil(main.db, context, D.host, '점검 d 학생회')
      const code = await inviteCodeOf(main.db, hostCouncil)
      const [left, right] = [open(), open()]
      const results = await Promise.allSettled([
        createdCouncil(left.db, context, D.newcomer, '점검 d 새 학생회'),
        joined(right.db, context, D.newcomer, code),
      ])
      const bad = unexpectedFailures(results, new Set())
      if (bad.length > 0) return fail('만들기나 들어오기가 예상하지 못한 오류로 끝났다', bad[0])
      const [created] = results
      const ownCouncil = created?.status === 'fulfilled' ? created.value : ''
      const logins = await main.db
        .select({ memberId: memberLogin.memberId })
        .from(memberLogin)
        .where(eq(memberLogin.userId, D.newcomer))
      const problems: string[] = []
      if (logins.length !== 1) problems.push(`로그인 연결 ${logins.length}개`)
      for (const [label, councilId] of [
        ['만든 학생회', ownCouncil],
        ['들어온 학생회', hostCouncil],
      ] as const) {
        const rows = await membershipsOf(main.db, D.newcomer, councilId)
        if (rows.length !== 1) problems.push(`${label} 소속 ${rows.length}개`)
      }
      return problems.length > 0
        ? fail(problems.join(', '))
        : pass('학생회마다 소속 1개(만든 곳 1, 들어온 곳 1), 로그인 연결 1개')
    }),
}

// 사례 e: 들어오기 거래가 users 행을 잠근 동안 세션 행 넣기 -------------------------------

function gate() {
  let release = () => {}
  const released = new Promise<void>(resolve => {
    release = resolve
  })
  return { released, release }
}

async function within<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<{ timedOut: true }>(resolve => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms)
  })
  try {
    return await Promise.race([
      promise.then(value => ({ timedOut: false as const, value })),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}

const E = { host: 'smoke-e-host', guest: 'smoke-e-guest' }

export const sessionDuringJoinCase: SmokeCase = {
  name: '들어오기 거래가 users 행을 잠근 동안 다른 연결이 세션 행 넣기',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, E.host)
      await googleUser(main.db, E.guest)
      const councilId = await createdCouncil(main.db, context, E.host, '점검 e 학생회')
      const code = await inviteCodeOf(main.db, councilId)
      const [locker, prober] = [open(), open()]
      const locked = gate()
      const release = gate()
      // 들어오기는 linkMember로 users 행을 FOR NO KEY UPDATE로 잠근다. 커밋을 미뤄 그 잠금을 쥐고 있는다.
      const held = locker.db.transaction(async tx => {
        await joinCouncil(tx, E.guest, code, context.now)
        locked.release()
        await release.released
      })
      try {
        // 잠금을 쥐기 전에 들어오기가 실패하면 held가 거절되어 여기서 던진다.
        await Promise.race([locked.released, held])
        const startedAt = Date.now()
        const probe = prober.db
          .insert(sessions)
          .values({
            id: 'smoke-e-session',
            userId: E.guest,
            token: 'smoke-e-token',
            expiresAt: new Date(context.now.getTime() + ONE_HOUR_MS),
          })
          .then(
            () => 'done' as const,
            (error: unknown) => ({ error }),
          )
        const first = await within(probe, context.sessionLimitMs)
        const elapsed = Date.now() - startedAt
        // 막혔든 아니든 잠금을 놓아 거래를 끝낸다. 막힌 쓰기도 이때 끝난다.
        release.release()
        const [heldResult] = await Promise.allSettled([held, probe])
        if (heldResult.status === 'rejected')
          return fail('들어오기 거래가 끝나지 못했다', errorCodeOf(heldResult.reason) || 'ERROR')
        if (first.timedOut)
          return fail(
            `세션 쓰기가 ${context.sessionLimitMs}ms 안에 끝나지 않았다(잠금이 막는다)`,
            'SESSION_BLOCKED',
          )
        if (first.value !== 'done')
          return fail('세션 쓰기가 실패했다', errorCodeOf(first.value.error) || 'ERROR')
        const rows = await prober.db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.userId, E.guest))
        return rows.length === 1
          ? pass(`세션 쓰기가 잠금 속에서 ${elapsed}ms에 끝났다`)
          : fail(`세션 행 ${rows.length}개`)
      } finally {
        release.release()
      }
    }),
}

export const smokeCases: readonly SmokeCase[] = [
  writePathCase,
  joinTwiceCase,
  rotateTogetherCase,
  transferAndRemoveCase,
  createAndJoinCase,
  sessionDuringJoinCase,
]
