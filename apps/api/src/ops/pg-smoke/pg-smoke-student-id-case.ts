import type { Db } from '../../db/types.js'
import { createRecord } from '../../records/records.js'
import { fail, pass, unexpectedFailures, withConnections, type SmokeCase } from './pg-smoke-kit.js'
import { outcomeProblem, raceHolding, warmed } from './pg-smoke-money-kit.js'
import { applyAs, raceSceneOf, savedProblem, type Race } from './pg-smoke-registration-cases.js'

// 같은 양식에 같은 학번 신청 둘이 겹치는 사례(DEC-107). 정원이 없는 양식이라 정원이 아니라 학번 확인이 막아야 한다.
// 양식 행 잠금 뒤에 학번을 읽지 않으면 둘 다 앞 신청을 보지 못하고 둘 다 들어간다. 서비스 함수를 라우트와 같은 거래로 부른다.
// PGlite는 거래를 하나씩 돌려 이것을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.

const WHO = { host: 'smoke-dup-host', councilName: '점검 학번 학생회', codePrefix: 'DUPS222' }
const EXPECTED = new Set(['DUPLICATE_STUDENT_ID'])
const STUDENT_ID = '202600777'
const ROUNDS = 4
const PAIR = 2
const HOUR_MS = 3_600_000
const CLOSES_IN_HOURS = 24
const FIRST_CODE_DIGIT = 2

// 학번을 받고 정원이 없는 양식 하나
async function studentIdForm(run: Race, round: number) {
  const code = `${run.codePrefix}${round + FIRST_CODE_DIGIT}`
  await run.main.db.transaction(tx =>
    createRecord(tx, {
      kind: 'registration_form',
      councilId: run.councilId,
      actor: run.memberId,
      values: {
        eventId: run.eventId,
        name: `학번 점검 ${round}`,
        closesAt: new Date(run.context.now.getTime() + CLOSES_IN_HOURS * HOUR_MS),
        publicCode: code,
        collectsStudentId: true,
      },
    }),
  )
  return code
}

// 짝수 번째는 먼저 신청한 쪽이 잠금을 쥔 채 기다리는 동안, 홀수 번째는 둘이 함께 시작한다.
async function round(run: Race, index: number) {
  const code = await studentIdForm(run, index)
  const [first, second] = (await warmed(run.open, PAIR)) as [Db, Db]
  const apply = (db: Db, hold?: () => Promise<void>) =>
    applyAs(db, run, code, hold ? { hold, studentId: STUDENT_ID } : { studentId: STUDENT_ID })
  const holding = index % PAIR === 0
  const results = holding
    ? await raceHolding(hold => apply(first, hold), [() => apply(second)])
    : await Promise.allSettled([apply(first), apply(second)])
  const bad = unexpectedFailures(results, EXPECTED)
  if (bad.length > 0) return fail(`${index}번째: 예상하지 못한 오류로 끝났다`, bad[0])
  // 함께 시작하면 어느 쪽이 먼저일지 모르므로 순서 없이 본다.
  const ordered = holding ? results : [...results].sort(okFirst)
  const problem =
    outcomeProblem(ordered, ['ok', 'DUPLICATE_STUDENT_ID']) ?? (await savedProblem(run, code))
  return problem ? fail(`${index}번째: ${problem}`) : undefined
}

const okFirst = (a: PromiseSettledResult<unknown>, b: PromiseSettledResult<unknown>) =>
  Number(a.status === 'rejected') - Number(b.status === 'rejected')

export const sameStudentIdTogetherCase: SmokeCase = {
  name: '같은 양식에 같은 학번 신청 둘을 동시에',
  run: context =>
    withConnections(context, async open => {
      const run = await raceSceneOf(context, open, WHO)
      for (let index = 0; index < ROUNDS; index++) {
        const verdict = await round(run, index)
        if (verdict) return verdict
      }
      return pass(
        `${ROUNDS}번 모두 신청 하나만 되고 나머지는 같은 학번(DUPLICATE_STUDENT_ID)으로 막혔다`,
      )
    }),
}
