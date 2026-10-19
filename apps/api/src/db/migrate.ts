import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { checkTarget, describeTarget, localMigrations, readTargetState, targetSourceOf } from './migrate-check.js'

const migrationsFolder = fileURLToPath(new URL('../../migrations', import.meta.url))

// 사용법: npm run db:migrate --workspace @vada/api [-- --dry-run] [-- --from-shell]
// 대상은 이 프로젝트의 .env다. 다른 DB(배포)는 셸에 DATABASE_URL을 주고 --from-shell을 붙일 때만 쓴다.
// 셸에 DATABASE_URL이 있는데 --from-shell이 없으면 멈춘다. 남은 셸 주소로 모르게 배포 DB에 적용하지 않는다.
// 적용 전에 대상을 점검한다: 기록이 없으면 빈 DB여야 하고, 기록이 있으면 로컬 파일과 순서·해시가 같아야 한다.
// --dry-run은 대상과 점검 결과만 찍고 아무것도 바꾸지 않는다.
async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const target = targetSourceOf(process.argv.includes('--from-shell'), process.env.DATABASE_URL)
  if ('stop' in target) {
    console.error(target.stop === 'SHELL_URL_WITHOUT_FLAG'
      ? '셸에 DATABASE_URL이 있다. 그 DB에 적용하려면 --from-shell을 붙이고, .env의 DB에 적용하려면 셸의 DATABASE_URL을 지운다. 아무것도 하지 않았다.'
      : '--from-shell을 줬지만 셸에 DATABASE_URL이 없다. 아무것도 하지 않았다.')
    process.exitCode = 1
    return
  }
  const url = target.source === 'shell' ? target.url : parseEnv(readFileSync(new URL('../../../../.env', import.meta.url), 'utf8')).DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is missing')
  console.log(`대상: ${describeTarget(url)} (${target.source === 'shell' ? '셸의 DATABASE_URL' : '.env'})`)
  const client = postgres(url, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {} })
  try {
    const local = localMigrations(migrationsFolder)
    const state = await readTargetState(async text => [...await client.unsafe(text)])
    console.log(`public 표 ${state.publicTables}개, 적용 기록 ${state.applied?.length ?? '없음'}, 로컬 마이그레이션 ${local.length}개`)
    const check = checkTarget(state, local)
    if (!check.ok) {
      console.error(check.reason === 'NOT_EMPTY'
        ? '적용 기록이 없는데 표가 있다. 빈 DB가 아니므로 적용하지 않는다.'
        : '이미 적용된 기록이 로컬 마이그레이션과 순서나 해시가 다르다. 적용하지 않는다.')
      process.exitCode = 1
      return
    }
    if (dryRun) {
      console.log(`적용할 마이그레이션 ${check.pending}개. --dry-run이라 바꾸지 않았다.`)
      return
    }
    await migrate(drizzle(client), { migrationsFolder })
    console.log(`마이그레이션 적용 완료(${check.pending}개)`)
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  console.error('마이그레이션 실패. 연결 문자열과 오류 원문은 출력하지 않습니다.',
    /^[A-Z0-9_]+$/.test(code) ? code : '')
  process.exitCode = 1
})
