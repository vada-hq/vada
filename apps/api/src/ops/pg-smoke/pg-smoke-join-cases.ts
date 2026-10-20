import { eq } from 'drizzle-orm'
import { inviteCode, memberLogin } from '../../db/schema.js'
import { invitedCouncil, rotateInviteCode } from '../../invites/service.js'
import { changeRank, removeMember, transferPresident } from '../../team/service.js'
import {
  changer,
  createdCouncil,
  fail,
  googleUser,
  inviteCodeOf,
  joined,
  memberIdOf,
  membershipsOf,
  outcomeOf,
  pass,
  presidentCount,
  unexpectedFailures,
  withConnections,
  type SmokeCase,
} from './pg-smoke-kit.js'

// 들어오기, 초대 코드, 회장 자리를 둘러싼 동시 처리 사례 a~d.

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
      await changer(main.db, context, { userId: B.president, councilId })(
        'rank.manage',
        (tx, actor) => changeRank(tx, actor, viceMember, 'vice_president'),
      )
      const [left, right] = [open(), open()]
      const results = await Promise.allSettled([
        changer(left.db, context, { userId: B.president, councilId })(
          'invite.manage',
          rotateInviteCode,
        ),
        changer(right.db, context, { userId: B.vice, councilId })(
          'invite.manage',
          rotateInviteCode,
        ),
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
      await changer(main.db, context, { userId: C.president, councilId })(
        'rank.manage',
        (tx, actor) => changeRank(tx, actor, viceMember, 'vice_president'),
      )
      const [left, right] = [open(), open()]
      const results = await Promise.allSettled([
        changer(left.db, context, { userId: C.president, councilId })(
          'president.transfer',
          (tx, actor) => transferPresident(tx, actor, targetMember),
        ),
        changer(right.db, context, { userId: C.vice, councilId })('member.manage', (tx, actor) =>
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
