import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { assignDepartment, seedTestCouncil } from './test-data.js'

async function main() {
  const args = process.argv.slice(2)
  const isSeed = args.length === 2 && args[0] === 'seed' && args[1] === '--apply'
  const isAssign = args.length === 4 && args[0] === 'assign' && Boolean(args[1]?.trim())
    && (args[2] === 'planning' || args[2] === 'finance') && args[3] === '--apply'
  if (!isSeed && !isAssign) {
    console.error('사용법: seed --apply 또는 assign <user-id> <planning|finance> --apply')
    process.exitCode = 1
    return
  }
  // 명시적으로 실행한 경우에만 프로젝트 루트 .env의 DB에 연결한다.
  const env = parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8'))
  if (!env.DATABASE_URL) throw new Error('Missing configuration')
  const client = postgres(env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {} })
  try {
    const db = drizzle(client)
    if (isSeed) await seedTestCouncil(db)
    else await assignDepartment(db, args[1]!, args[2] as 'planning' | 'finance')
    console.log(isSeed ? '검증 학생회·부서 준비 완료' : '검증 계정 소속 지정 완료')
  } finally { await client.end({ timeout: 5 }) }
}

main().catch(() => {
  console.error('처리 실패. DB 연결·기존 Google 사용자·초기 데이터·소속 충돌을 확인하세요. 오류 원문은 출력하지 않습니다.')
  process.exitCode = 1
})
