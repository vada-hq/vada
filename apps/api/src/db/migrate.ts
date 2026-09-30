import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

async function main() {
  // 상위 셸의 운영 환경 변수 대신 이 프로젝트의 .env만 읽는다.
  const env = parseEnv(readFileSync(new URL('../../../../.env', import.meta.url), 'utf8'))
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing')
  const client = postgres(env.DATABASE_URL, {
    max: 1,
    ssl: { rejectUnauthorized: true },
    connect_timeout: 15,
    onnotice: () => {},
  })
  try {
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)),
    })
    console.log('마이그레이션 적용 완료')
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
