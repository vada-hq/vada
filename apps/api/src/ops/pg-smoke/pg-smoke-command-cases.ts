import { randomUUID } from 'node:crypto'
import type { Db } from '../../db/types.js'
import { errorCodeOf } from '../../db/error-code.js'
import {
  applyAs,
  oneSeatForm,
  raceSceneOf,
  savedProblem,
  type Race,
} from './pg-smoke-registration-cases.js'
import { fail, pass, unexpectedFailures, withConnections, type SmokeCase } from './pg-smoke-kit.js'
import { outcomeProblem, raceHolding, warmed } from './pg-smoke-money-kit.js'

// 같은 명령 번호의 재전송이 겹쳐도 신청과 영수증이 하나만 남는지(기능 017, DEC-84, RULE-45). 서비스 함수를 라우트와 같은 거래로 불러 운영과 같은 길을 탄다.
// 정원이 1인 양식이라 영수증을 못 보면 두 번째 신청이 REGISTRATION_FULL이 된다: 둘 다 성공(ok,ok)해야 한다.
// 양식 행 잠금이 없어도 command_receipt의 UNIQUE가 마지막으로 막으므로(23505) 둘 다 저장되는 일은 없다. PGlite는 거래를 하나씩 돌려 이것을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.

const WHO = { host: 'smoke-cmd-host', councilName: '점검 명령 학생회', codePrefix: 'CMDS222' }
const ROUNDS = 4
const PAIR = 2
const UNIQUE_VIOLATION = '23505'

// 영수증이 이 양식에 하나만 있는지
async function receiptProblem(run: Race, code: string) {
  const [saved] = await run.main.sql.unsafe(
    `SELECT count(*)::text AS n FROM command_receipt c
     JOIN registration r ON r.id = c.result_id
     JOIN registration_form f ON f.id = r.form_id WHERE f.public_code = $1`,
    [code],
  )
  return saved?.n === '1' ? undefined : `영수증 ${String(saved?.n)}개(하나여야 한다)`
}

// 먼저 보낸 쪽이 양식 행 잠금을 쥔 채 기다리는 동안 같은 명령이 들어온다: 잠금 뒤에 영수증을 읽어 새 신청 없이 ok여야 한다.
async function holdingRound(run: Race, round: number) {
  const code = await oneSeatForm(run, round)
  const commandId = randomUUID()
  const [first, second] = (await warmed(run.open, PAIR)) as [Db, Db]
  return raceHolding(
    hold => applyAs(first, run, code, { hold, commandId }),
    [() => applyAs(second, run, code, { commandId })],
  ).then(results => ({ results, code }))
}

// 기다리는 쪽 없이 둘이 동시에 시작한다.
async function plainRound(run: Race, round: number) {
  const code = await oneSeatForm(run, round)
  const commandId = randomUUID()
  const [first, second] = (await warmed(run.open, PAIR)) as [Db, Db]
  const results = await Promise.allSettled([
    applyAs(first, run, code, { commandId }),
    applyAs(second, run, code, { commandId }),
  ])
  return { results, code }
}

// UNIQUE가 막는지: 같은 (종류, 범위, 번호)의 영수증을 하나 더 넣으면 23505다. 앱의 잠금이 틀려도 둘이 남지 않게 하는 마지막 겹이다.
async function uniqueProblem(run: Race, code: string) {
  try {
    await run.main.sql.unsafe(
      `INSERT INTO command_receipt (kind, scope_key, command_id, body_hash, result_id)
       SELECT c.kind, c.scope_key, c.command_id, c.body_hash, c.result_id FROM command_receipt c
       JOIN registration r ON r.id = c.result_id
       JOIN registration_form f ON f.id = r.form_id WHERE f.public_code = $1`,
      [code],
    )
    return '같은 명령의 영수증이 하나 더 들어갔다(UNIQUE가 없다)'
  } catch (error) {
    return errorCodeOf(error) === UNIQUE_VIOLATION ? undefined : '23505가 아닌 오류로 멈췄다'
  }
}

export const sameCommandTogetherCase: SmokeCase = {
  name: '같은 명령을 동시에 두 번',
  run: context =>
    withConnections(context, async open => {
      const run = await raceSceneOf(context, open, WHO)
      for (let round = 0; round < ROUNDS; round++) {
        const { results, code } =
          round % PAIR === 0 ? await holdingRound(run, round) : await plainRound(run, round)
        const bad = unexpectedFailures(results, new Set())
        if (bad.length > 0) return fail(`${round}번째: 예상하지 못한 오류로 끝났다`, bad[0])
        const problem =
          outcomeProblem(results, ['ok', 'ok']) ??
          (await savedProblem(run, code)) ??
          (await receiptProblem(run, code)) ??
          (await uniqueProblem(run, code))
        if (problem) return fail(`${round}번째: ${problem}`)
      }
      return pass(`${ROUNDS}번 모두 둘 다 성공하고 신청·개인 링크·영수증이 하나만 남았다`)
    }),
}
