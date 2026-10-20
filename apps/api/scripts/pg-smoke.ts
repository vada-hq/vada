import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { migrationsFolder } from '../src/ops/migrate/migrations-folder.js'
import { smokeCases } from '../src/ops/pg-smoke/pg-smoke-cases.js'
import { runPgSmoke } from '../src/ops/pg-smoke/pg-smoke.js'

// 사용법(apps/api에서): npx tsx --env-file=../../.env scripts/pg-smoke.ts   (운영 서버는 --env-file=../../.env.production)
// 이 도구는 .env를 읽지 않고 환경 변수 DATABASE_URL만 쓴다(같은 서버의 관리 주소). npm run pg-smoke --workspace @vada/api는 셸에 DATABASE_URL이 있을 때만 쓴다.
// 같은 서버에 잠깐 쓸 DB를 만들어 마이그레이션하고, 운영 드라이버(postgres-js)로 쓰기 길과 동시 처리 사례를 돌린 뒤 지운다.
// 판단은 모두 src/ops/pg-smoke/pg-smoke.ts와 pg-smoke-cases.ts에 있다. 여기는 실제 연결을 이어 주기만 한다. 에이전트 가운데 진행을 맡은 쪽만 실행한다(실제 서버에 DB를 만든다).
const options = {
  max: 1,
  ssl: { rejectUnauthorized: true },
  connect_timeout: 15,
  onnotice: () => {},
} as const

process.exitCode = await runPgSmoke({
  databaseUrl: process.env.DATABASE_URL,
  // 연결마다 postgres-js 클라이언트를 따로 연다. 동시에 움직이는 쪽이 서로 다른 DB 연결을 쓰게 하려는 것이다.
  connect: url => {
    const client = postgres(url, options)
    return {
      db: drizzle(client),
      sql: { unsafe: async (text, params) => [...(await client.unsafe(text, params))] },
      end: () => client.end({ timeout: 5 }),
    }
  },
  migrate: async url => {
    const client = postgres(url, options)
    try {
      await migrate(drizzle(client), { migrationsFolder })
    } finally {
      await client.end({ timeout: 5 })
    }
  },
  cases: smokeCases,
  now: () => new Date(),
  log: { info: line => console.log(line), error: line => console.error(line) },
})
