import type { Db } from '../../db/types.js'
import { createRecord } from '../../records/records.js'
import { applyToForm } from '../../registrations/apply.js'
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
import { outcomeProblem, raceHolding, warmed } from './pg-smoke-money-kit.js'

// 참가 신청(기능 007)의 동시 처리 사례 o. 서비스 함수를 라우트와 같은 거래로 불러 운영과 같은 길을 탄다.
// 마지막 한 자리에 두 신청이 겹치면 하나만 되고 나머지는 REGISTRATION_FULL이어야 한다. 양식 행 잠금이 없으면 둘 다 센 수 0을 보고 둘 다 들어간다.
// PGlite는 거래를 하나씩 돌려 이것을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.

const EXPECTED = new Set(['REGISTRATION_FULL'])
// 계좌 사례가 moneyScene 글자 o, p를 쓰므로 겹치지 않는 글자를 쓴다(겹치면 사용자 만들기가 23505로 멈춘다).
const O = { host: 'smoke-s-host' }
const ROUNDS = 4
const PAIR = 2
const HOUR_MS = 3_600_000
const CLOSES_IN_HOURS = 24
const FIRST_CODE_DIGIT = 2
// 공개 코드 형식(^[2-9A-HJ-NP-Z]{8}$)에 맞는, 점검 DB 안에서 겹치지 않는 코드
const codeOf = (round: number) => `RACE222${round + FIRST_CODE_DIGIT}`

type Race = {
  main: SmokeConnection
  open: () => SmokeConnection
  context: SmokeContext
  councilId: string
  memberId: string
  eventId: string
}

// 정원 1인 양식 하나(자리가 하나 남은 양식)
async function oneSeatForm(run: Race, round: number) {
  const code = codeOf(round)
  await run.main.db.transaction(tx =>
    createRecord(tx, {
      kind: 'registration_form',
      councilId: run.councilId,
      actor: run.memberId,
      values: {
        eventId: run.eventId,
        name: `점검 ${round}`,
        closesAt: new Date(run.context.now.getTime() + CLOSES_IN_HOURS * HOUR_MS),
        capacity: 1,
        publicCode: code,
        // 이름만으로 신청하므로 학번 받기를 끈다(DEC-75).
        collectsStudentId: false,
      },
    }),
  )
  return code
}

const applyAs = (db: Db, run: Race, code: string, hold?: () => Promise<void>) =>
  db.transaction(async tx => {
    const done = await applyToForm(
      tx,
      { code, now: run.context.now },
      {
        name: '점검 신청자',
        studentId: null,
        phone: null,
      },
    )
    await hold?.()
    return done
  })

// 신청이 하나만 남았는지: 취소하지 않은 신청과 개인 링크가 모두 하나다.
async function savedProblem(run: Race, code: string) {
  const [saved] = await run.main.sql.unsafe(
    `SELECT count(*)::text AS n, count(l.registration_id)::text AS links
     FROM registration r JOIN registration_form f ON f.id = r.form_id
     LEFT JOIN registration_link l ON l.registration_id = r.id
     WHERE f.public_code = $1 AND r.cancelled_at IS NULL`,
    [code],
  )
  return saved?.n === '1' && saved.links === '1'
    ? undefined
    : `신청 ${String(saved?.n)}개, 링크 ${String(saved?.links)}개(정원 1이라 각각 1개여야 한다)`
}

// 먼저 신청한 쪽이 양식 행 잠금을 쥔 채 기다리는 동안 다른 신청이 들어온다: 잠금 뒤에 센 수를 다시 읽어 FULL이어야 한다.
async function holdingRound(run: Race, round: number) {
  const code = await oneSeatForm(run, round)
  const [first, second] = (await warmed(run.open, PAIR)) as [Db, Db]
  const results = await raceHolding(
    hold => applyAs(first, run, code, hold),
    [() => applyAs(second, run, code)],
  )
  const bad = unexpectedFailures(results, EXPECTED)
  if (bad.length > 0) return fail('신청이 예상하지 못한 오류로 끝났다', bad[0])
  return outcomeProblem(results, ['ok', 'REGISTRATION_FULL']) ?? (await savedProblem(run, code))
}

// 잠금을 쥐고 기다리는 쪽 없이 둘이 동시에 시작한다. 어느 쪽이 되든 하나만 되고 하나는 FULL이다.
async function plainRound(run: Race, round: number) {
  const code = await oneSeatForm(run, round)
  const [first, second] = (await warmed(run.open, PAIR)) as [Db, Db]
  const results = await Promise.allSettled([applyAs(first, run, code), applyAs(second, run, code)])
  const bad = unexpectedFailures(results, EXPECTED)
  if (bad.length > 0) return fail('신청이 예상하지 못한 오류로 끝났다', bad[0])
  const outcomes = results.map(outcomeOf).sort().join(',')
  return outcomes === 'REGISTRATION_FULL,ok'
    ? await savedProblem(run, code)
    : `결과가 ${outcomes}(기대 REGISTRATION_FULL,ok)`
}

export const lastSeatTogetherCase: SmokeCase = {
  name: '마지막 한 자리에 두 신청을 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, O.host)
      const councilId = await createdCouncil(main.db, context, O.host, '점검 o 학생회')
      const memberId = await memberIdOf(main.db, O.host)
      const eventId = await main.db.transaction(tx =>
        createRecord(tx, {
          kind: 'event',
          councilId,
          actor: memberId,
          values: { name: '점검 행사' },
        }),
      )
      const run = { main, open, context, councilId, memberId, eventId }
      for (let round = 0; round < ROUNDS; round++) {
        const problem =
          round % PAIR === 0 ? await holdingRound(run, round) : await plainRound(run, round)
        if (problem) return typeof problem === 'string' ? fail(`${round}번째: ${problem}`) : problem
      }
      return pass(
        `${ROUNDS}번 모두 신청 하나만 되고 나머지는 정원 참(REGISTRATION_FULL)으로 막혔다`,
      )
    }),
}
