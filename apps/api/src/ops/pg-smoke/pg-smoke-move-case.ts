import { and, eq, isNull } from 'drizzle-orm'
import { department, departmentMembership } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { moveDepartment } from '../../team/move.js'
import { assignDepartment, changeRank, createDepartment } from '../../team/service.js'
import {
  changer,
  createdCouncil,
  fail,
  googleUser,
  inviteCodeOf,
  joined,
  memberIdOf,
  outcomeOf,
  pass,
  unexpectedFailures,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'

// 부서 옮기기(기능 023 조각 3)를 둘러싼 동시 처리 사례.

// 둘이 같은 사람을 같은 옛 부서에서 서로 다른 부서로 옮긴다. 학생회 행 잠금으로 하나씩 처리되어 나중 것은 옛 소속이 끝나 있어 NOT_FOUND다.
const MOVE_EXPECTED = new Set(['NOT_FOUND'])

const M = { president: 'smoke-m-president', vice: 'smoke-m-vice', target: 'smoke-m-target' }
const NAMES = ['점검 가부', '점검 나부', '점검 다부'] as const

// 회장, 부회장, 대상(가부의 부원)과 부서 셋을 둔다.
async function prepared(db: Db, context: SmokeContext) {
  for (const user of Object.values(M)) await googleUser(db, user)
  const councilId = await createdCouncil(db, context, M.president, '점검 m 학생회')
  const code = await inviteCodeOf(db, councilId)
  await joined(db, context, M.vice, code)
  await joined(db, context, M.target, code)
  const vice = await memberIdOf(db, M.vice)
  const target = await memberIdOf(db, M.target)
  const asPresident = changer(db, context, { userId: M.president, councilId })
  await asPresident('rank.manage', (tx, actor) => changeRank(tx, actor, vice, 'vice_president'))
  for (const name of NAMES)
    await asPresident('department.manage', (tx, actor) => createDepartment(tx, actor, name))
  const rows = await db
    .select({ id: department.id, name: department.name })
    .from(department)
    .where(eq(department.councilId, councilId))
  const [from, left, right] = NAMES.map(name => rows.find(row => row.name === name)!.id)
  await asPresident('member.manage', (tx, actor) =>
    assignDepartment(tx, actor, { memberId: target, departmentId: from!, rank: null }),
  )
  return { councilId, target, from: from!, left: left!, right: right! }
}

export const moveTogetherCase: SmokeCase = {
  name: '회장단 둘이 같은 사람을 서로 다른 부서로 동시에 옮기기',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const { councilId, target, from, left, right } = await prepared(main.db, context)
      const moveTo = (userId: string, db: Db, to: string) =>
        changer(db, context, { userId, councilId })('member.manage', (tx, actor) =>
          moveDepartment(tx, actor, target, {
            fromDepartmentId: from,
            toDepartmentId: to,
            rank: null,
          }),
        )
      const results = await Promise.allSettled([
        moveTo(M.president, open().db, left),
        moveTo(M.vice, open().db, right),
      ])
      const bad = unexpectedFailures(results, MOVE_EXPECTED)
      if (bad.length > 0) return fail('옮기기가 예상하지 못한 오류로 끝났다', bad[0])
      const outcomes = results.map(outcomeOf).join(', ')
      if (results.filter(result => result.status === 'fulfilled').length !== 1)
        return fail(`둘 중 하나만 끝나야 한다(${outcomes})`)
      const openRows = await main.db
        .select({ id: departmentMembership.id })
        .from(departmentMembership)
        .where(and(eq(departmentMembership.memberId, target), isNull(departmentMembership.endsAt)))
      return openRows.length === 1
        ? pass(`열린 부서 소속 1개(${outcomes})`)
        : fail(`열린 부서 소속 ${openRows.length}개(${outcomes})`)
    }),
}
