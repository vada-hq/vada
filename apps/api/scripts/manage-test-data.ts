import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { assignTestMember, seedTestCouncil, type TestDepartment } from './test-data.js'

// 사용법(저장소 맨 위에서):
//   npm run test-data --workspace @vada/api -- seed <user-id> --apply           시험 학생회를 두고 그 계정을 회장으로 둔다
//   npm run test-data --workspace @vada/api -- assign <user-id> <planning|finance> --apply   그 계정을 부서원으로 넣는다
// 명시적으로 실행한 경우에만 이 프로젝트 .env의 개발 DB에 연결한다. 사람만 실행한다.
async function main() {
  const args = process.argv.slice(2)
  const isSeed = args.length === 3 && args[0] === 'seed' && Boolean(args[1]?.trim()) && args[2] === '--apply'
  const isAssign = args.length === 4 && args[0] === 'assign' && Boolean(args[1]?.trim())
    && (args[2] === 'planning' || args[2] === 'finance') && args[3] === '--apply'
  if (!isSeed && !isAssign) {
    console.error('사용법: seed <user-id> --apply 또는 assign <user-id> <planning|finance> --apply')
    process.exitCode = 1
    return
  }
  const env = parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8'))
  if (!env.DATABASE_URL) throw new Error('Missing configuration')
  const client = postgres(env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {} })
  try {
    const db = drizzle(client)
    if (isSeed) await seedTestCouncil(db, args[1]!, new Date())
    else await assignTestMember(db, args[1]!, args[2] as TestDepartment, new Date())
    console.log(isSeed ? '시험 학생회 준비 완료(초대 코드 TESTDATA)' : '시험 학생회 부서 배정 완료')
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch(() => {
  console.error('처리 실패. DB 연결, 기존 Google 계정, 시험 학생회의 회장과 부서를 확인하세요. 오류 원문은 출력하지 않습니다.')
  process.exitCode = 1
})
