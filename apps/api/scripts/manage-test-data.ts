import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { describeTarget } from '../src/ops/migrate/migrate-check.js'
import { readLocalEnv } from '../src/local-env.js'
import { withoutSeparator } from '../src/ops/script-args.js'
import type { Db } from '../src/db/types.js'
import { seedTestPeriods } from './test-data-periods.js'
import {
  assignTestMember,
  parseTestDataArgs,
  seedTestCouncil,
  stepOf,
  type TestDataCommand,
} from './test-data.js'

// 사용법(저장소 맨 위에서, 플래그 앞의 --를 빠뜨리지 않는다):
//   pnpm --filter @vada/api test-data seed <user-id> [--apply]                        시험 학생회를 두고 그 계정을 회장으로 둔다
//   pnpm --filter @vada/api test-data periods <user-id> [--apply]                     끝난 기간(시험 1학기)과 지금 기간을 둔다(재정부 계정)
//   pnpm --filter @vada/api test-data assign <user-id> <planning|finance> [--apply]   그 계정을 부서원으로 넣는다
// --apply가 없으면 대상(호스트와 DB 이름)과 하려는 일만 보여 주고 아무것도 쓰지 않는다. 인자가 맞지 않으면 .env를 읽기 전에 멈춘다.
// 이 프로젝트 .env의 개발 DB에 연결한다. 사람만 실행한다(실제 DB에 연결한다).
async function run(db: Db, parsed: TestDataCommand) {
  const now = new Date()
  if (parsed.command === 'seed') {
    await seedTestCouncil(db, parsed.userId, now)
    return '시험 학생회 준비 완료(초대 코드 TESTDATA)'
  }
  if (parsed.command === 'periods')
    return (await seedTestPeriods(db, parsed.userId, now)) === 'created'
      ? '시험 학생회에 끝난 기간과 지금 기간을 두었다'
      : '이미 있어 바꾸지 않았다'
  await assignTestMember(db, parsed.userId, parsed.department, now)
  return '시험 학생회 부서 배정 완료'
}

const FIRST_USER_ARG = 2 // argv[0]은 node, argv[1]은 이 파일이다.
async function main() {
  const parsed = parseTestDataArgs(withoutSeparator(process.argv.slice(FIRST_USER_ARG)))
  if (!parsed) {
    console.error(
      '사용법: seed <user-id> [--apply], periods <user-id> [--apply] 또는 assign <user-id> <planning|finance> [--apply]. 아무것도 하지 않았다.',
    )
    process.exitCode = 1
    return
  }
  const env = readLocalEnv()
  if (!env.DATABASE_URL) throw new Error('Missing configuration')
  const target = describeTarget(env.DATABASE_URL)
  console.log(`대상: ${target} (.env)`)
  const step = stepOf(parsed, target)
  if (step.step === 'preview') {
    console.log(step.message)
    return
  }
  if (step.step === 'stop') {
    console.error(step.message)
    process.exitCode = 1
    return
  }
  const client = postgres(env.DATABASE_URL, {
    max: 1,
    ssl: { rejectUnauthorized: true },
    connect_timeout: 15,
    onnotice: () => {},
  })
  try {
    const db = drizzle(client)
    console.log(await run(db, parsed))
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch(() => {
  console.error(
    '처리 실패. DB 연결, 기존 Google 계정, 시험 학생회의 회장과 부서를 확인하세요. 오류 원문은 출력하지 않습니다.',
  )
  process.exitCode = 1
})
