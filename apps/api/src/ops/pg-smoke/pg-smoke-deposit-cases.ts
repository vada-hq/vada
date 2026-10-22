import type { Actor } from '../../access/actor.js'
import type { Db } from '../../db/types.js'
import { confirmDeposit } from '../../deposits/service.js'
import { createRecord } from '../../records/records.js'
import { applyToForm } from '../../registrations/apply.js'
import { hashOfToken } from '../../registrations/link.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  createdCouncil,
  fail,
  googleUser,
  memberIdOf,
  outcomeOf,
  pass,
  unexpectedFailures,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'
import { raceHolding, warmed } from './pg-smoke-money-kit.js'

// 입금 확인(기능 008)의 동시 처리 사례 u. 서비스 함수를 라우트와 같은 거래로 부르되 학생회 행 잠금(inCouncilChange)은 걸지 않는다.
// 그래야 신청 행 잠금 뒤 다시 읽기와 부분 유일 인덱스가 스스로 지키는지 본다. 같은 신청에 두 사람이 겹쳐 확인하면 하나만 되고 나머지는 DEPOSIT_EXISTS다.
// PGlite는 거래를 하나씩 돌려 이것을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.
// 사용자 이름 글자는 다른 사례와 겹치지 않아야 한다(겹치면 사용자 만들기가 23505로 멈춘다). 계좌 m·o·p, 구매 k·l이 쓰고 있다.
const U = { host: 'smoke-u-host' }
const ROUNDS = 4
const PAIR = 2
const HOUR_MS = 3_600_000
const CLOSES_IN_HOURS = 24
const AMOUNT = '5000'
const EXPECTED = new Set(['DEPOSIT_EXISTS'])

async function scene(main: Db, context: SmokeContext, code: string) {
  const { now } = context
  await googleUser(main, U.host)
  const councilId = await createdCouncil(main, context, U.host, `점검 ${code} 학생회`)
  const memberId = await memberIdOf(main, U.host)
  const eventId = await main.transaction(tx =>
    createRecord(tx, { kind: 'event', councilId, actor: memberId, values: { name: '점검 행사' } }),
  )
  await main.transaction(tx =>
    createRecord(tx, {
      kind: 'registration_form',
      councilId,
      actor: memberId,
      values: {
        eventId,
        name: '점검 양식',
        closesAt: new Date(now.getTime() + CLOSES_IN_HOURS * HOUR_MS),
        publicCode: code,
      },
    }),
  )
  // 권한표는 회장단 직급만 본다. 나머지 칸은 쓰지 않는다.
  const actor: Actor = {
    memberId,
    councilId,
    cohortId: memberId,
    membershipId: memberId,
    councilRank: 'president',
    departments: [],
  }
  return actor
}

const liveDeposits = async (sql: SmokeConnection['sql']) => {
  const [row] = await sql.unsafe(
    'SELECT count(*)::text AS n FROM deposit WHERE cancelled_at IS NULL',
  )
  return Number(row?.n)
}

export const confirmTogetherCase: SmokeCase = {
  name: '같은 신청의 입금 확인이 겹침',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const actor = await scene(main.db, context, 'DEPSTU22')
      for (let round = 0; round < ROUNDS; round++) {
        const { token } = await main.db.transaction(tx =>
          applyToForm(
            tx,
            { code: 'DEPSTU22', now: context.now },
            { name: '점검 신청자', studentId: null, phone: null },
          ),
        )
        const [link] = await main.sql.unsafe(
          'SELECT registration_id FROM registration_link WHERE token_hash = $1',
          [hashOfToken(token)],
        )
        const registrationId = String(link?.registration_id)
        const [first, second] = (await warmed(open, PAIR)) as [Db, Db]
        const confirmAs = (db: Db, hold?: () => Promise<void>) =>
          db.transaction(async tx => {
            const done = await confirmDeposit(tx, actor, registrationId, { amount: Number(AMOUNT) })
            await hold?.()
            return done
          })
        const results =
          round % PAIR === 0
            ? await raceHolding(hold => confirmAs(first, hold), [() => confirmAs(second)])
            : await Promise.allSettled([confirmAs(first), confirmAs(second)])
        const bad = unexpectedFailures(results, EXPECTED)
        if (bad.length > 0) return fail(`${round}번째: 예상하지 못한 오류로 끝났다`, bad[0])
        const outcomes = results
          .map(outcomeOf)
          .sort((a, b) => a.localeCompare(b))
          .join(',')
        if (outcomes !== 'DEPOSIT_EXISTS,ok')
          return fail(`${round}번째: 결과가 ${outcomes}(기대 DEPOSIT_EXISTS,ok)`)
      }
      const live = await liveDeposits(main.sql)
      return live === ROUNDS
        ? pass(`${ROUNDS}번 모두 입금 확인 하나만 되고 나머지는 DEPOSIT_EXISTS였다`)
        : fail(`취소하지 않은 입금 기록이 ${live}개(${ROUNDS}개여야 한다)`)
    }),
}
