import { randomUUID } from 'node:crypto'
import type { Actor } from '../../access/actor.js'
import type { Db } from '../../db/types.js'
import { createRecord } from '../../records/records.js'
import { applyToForm } from '../../registrations/apply.js'
import { checkInByQr } from '../../registrations/attendance.js'
import { cancelMine } from '../../registrations/cancel-mine.js'
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
import { outcomeProblem, raceHolding, warmed } from './pg-smoke-money-kit.js'

// 출석(기능 007 조각 4)의 동시 처리 사례 p, q. 서비스 함수를 라우트와 같은 거래로 부르되, 라우트가 거는 학생회 행 잠금(inCouncilChange)은 걸지 않는다.
// 그래야 학생회 잠금이 줄을 세워 주는 것이 아니라 신청 행 잠금과 부분 유일 인덱스가 스스로 지키는지 본다(스스로 취소는 학생회 잠금을 쓰지 않는다).
// PGlite는 거래를 하나씩 돌려 이것을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.

// 계좌 사례가 moneyScene 글자 o, p를 쓰므로 겹치지 않는 글자를 쓴다.
const P = { host: 'smoke-t-host' }
const Q = { host: 'smoke-q-host' }
const ROUNDS = 4
const PAIR = 2
const HOUR_MS = 3_600_000
const CLOSES_IN_HOURS = 24
const EXPECTED = new Set(['CHECKED_IN', 'NOT_FOUND'])

type Race = {
  main: SmokeConnection
  open: () => SmokeConnection
  context: SmokeContext
  actor: Actor
  eventId: string
  code: string
}

// 학생회, 행사, 정원 없는 양식 하나, 그리고 회장 권한을 가진 운영진
async function scene(
  { main, open, context }: Pick<Race, 'main' | 'open' | 'context'>,
  who: { host: string },
  code: string,
): Promise<Race> {
  await googleUser(main.db, who.host)
  const councilId = await createdCouncil(main.db, context, who.host, `점검 ${code} 학생회`)
  const memberId = await memberIdOf(main.db, who.host)
  const eventId = await main.db.transaction(tx =>
    createRecord(tx, { kind: 'event', councilId, actor: memberId, values: { name: '점검 행사' } }),
  )
  await main.db.transaction(tx =>
    createRecord(tx, {
      kind: 'registration_form',
      councilId,
      actor: memberId,
      values: {
        eventId,
        name: '점검 양식',
        closesAt: new Date(context.now.getTime() + CLOSES_IN_HOURS * HOUR_MS),
        publicCode: code,
        // 이름만으로 신청하므로 학번 받기를 끈다(DEC-75).
        collectsStudentId: false,
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
  return { main, open, context, actor, eventId, code }
}

async function newRegistration(run: Race) {
  const { token } = await run.main.db.transaction(tx =>
    applyToForm(
      tx,
      { code: run.code, now: run.context.now, receiptKey: 'smoke-receipt-key' },
      { commandId: randomUUID(), name: '점검 신청자', studentId: null, phone: null, answers: [] },
    ),
  )
  return { token, hash: hashOfToken(token) }
}

const checkInAs = (db: Db, run: Race, hash: string, hold?: () => Promise<void>) =>
  db.transaction(async tx => {
    const done = await checkInByQr(tx, run.actor, {
      eventId: run.eventId,
      tokenHash: hash,
      ip: 'unknown',
    })
    await hold?.()
    return done
  })

const liveAttendances = async (run: Race, hash: string) => {
  const [row] = await run.main.sql.unsafe(
    `SELECT count(*)::text AS n FROM attendance a
     JOIN registration_link l ON l.registration_id = a.registration_id
     WHERE a.cancelled_at IS NULL AND l.token_hash = $1`,
    [hash],
  )
  return Number(row?.n)
}

// 같은 QR을 먼저 확인한 쪽이 신청 행 잠금을 쥔 채 기다리는 동안 다른 스캔이 들어온다: 잠금 뒤에 다시 읽어 already여야 한다.
async function sameQrRound(run: Race, round: number) {
  const { hash } = await newRegistration(run)
  const [first, second] = (await warmed(run.open, PAIR)) as [Db, Db]
  const results =
    round % PAIR === 0
      ? await raceHolding(
          hold => checkInAs(first, run, hash, hold),
          [() => checkInAs(second, run, hash)],
        )
      : await Promise.allSettled([checkInAs(first, run, hash), checkInAs(second, run, hash)])
  const bad = unexpectedFailures(results, new Set())
  if (bad.length > 0) return fail('출석 확인이 예상하지 못한 오류로 끝났다', bad[0])
  const already = results
    .flatMap(result =>
      result.status === 'fulfilled' ? [String((result.value as { already: boolean }).already)] : [],
    )
    .sort((a, b) => a.localeCompare(b))
    .join(',')
  if (already !== 'false,true') return `already가 ${already}(기대 false,true)`
  const live = await liveAttendances(run, hash)
  return live === 1 ? undefined : `취소하지 않은 출석이 ${live}개(1개여야 한다)`
}

export const sameQrTogetherCase: SmokeCase = {
  name: '같은 QR을 동시에 두 번 찍기',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const run = await scene({ main, open, context }, P, 'ATTENDP2')
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await sameQrRound(run, round)
        if (problem) return typeof problem === 'string' ? fail(`${round}번째: ${problem}`) : problem
      }
      return pass(`${ROUNDS}번 모두 출석 하나만 만들어지고 나머지는 이미 출석(already)이었다`)
    }),
}

// 취소한 신청에 취소하지 않은 출석이 함께 남은 어긋남이 없는지(스스로 취소는 출석 뒤에 CHECKED_IN이다)
async function consistencyProblem(run: Race) {
  const [row] = await run.main.sql.unsafe(
    `SELECT count(*)::text AS n FROM registration r
     WHERE r.cancelled_at IS NOT NULL
       AND EXISTS (SELECT 1 FROM attendance a WHERE a.registration_id = r.id AND a.cancelled_at IS NULL)`,
  )
  return row?.n === '0' ? undefined : '취소된 신청에 출석이 남았다'
}

// 출석 확인을 먼저 한 쪽이 잠금을 쥔 채 기다리는 동안 스스로 취소가 들어온다: 취소는 CHECKED_IN이다. 잠금 없이 시작하면 어느 쪽이 먼저든 한쪽만 된다.
async function cancelAndCheckInRound(run: Race, round: number) {
  const { token, hash } = await newRegistration(run)
  const [scanner, owner] = (await warmed(run.open, PAIR)) as [Db, Db]
  const cancel = () => owner.transaction(tx => cancelMine(tx, token, run.context.now))
  if (round % PAIR === 0) {
    const results = await raceHolding(hold => checkInAs(scanner, run, hash, hold), [cancel])
    const bad = unexpectedFailures(results, EXPECTED)
    if (bad.length > 0) return fail('예상하지 못한 오류로 끝났다', bad[0])
    return outcomeProblem(results, ['ok', 'CHECKED_IN']) ?? (await consistencyProblem(run))
  }
  const results = await Promise.allSettled([checkInAs(scanner, run, hash), cancel()])
  const bad = unexpectedFailures(results, EXPECTED)
  if (bad.length > 0) return fail('예상하지 못한 오류로 끝났다', bad[0])
  const outcomes = results.map(outcomeOf).join(',')
  // 출석이 먼저면 취소가 CHECKED_IN, 취소가 먼저면 출석이 NOT_FOUND다. 둘 다 되면 안 된다.
  return outcomes === 'ok,CHECKED_IN' || outcomes === 'NOT_FOUND,ok'
    ? await consistencyProblem(run)
    : `결과가 ${outcomes}(기대 ok,CHECKED_IN 또는 NOT_FOUND,ok)`
}

export const cancelAndCheckInCase: SmokeCase = {
  name: '스스로 취소와 출석 확인이 겹침',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const run = await scene({ main, open, context }, Q, 'ATTENDQ2')
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await cancelAndCheckInRound(run, round)
        if (problem) return typeof problem === 'string' ? fail(`${round}번째: ${problem}`) : problem
      }
      return pass(`${ROUNDS}번 모두 취소와 출석 중 하나만 되고 둘이 함께 남지 않았다`)
    }),
}
