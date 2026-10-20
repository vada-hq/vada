import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { readLocalEnv } from '../../local-env.js'
import { localMigrations } from './migrate-check.js'
import { migrationsFolder } from './migrations-folder.js'
import { runMigration } from './migrate-run.js'

// 사용법: npm run db:migrate --workspace @vada/api -- [--apply] [--from-shell]   (플래그 앞의 --를 빠뜨리지 않는다)
// 기본은 미리 보기다: 대상(호스트와 DB 이름)과 점검 결과만 찍고 아무것도 바꾸지 않는다(--dry-run은 같은 뜻을 분명히 적는 것). 실제 적용은 --apply를 줄 때만 한다.
// 대상은 이 프로젝트의 .env다. 다른 DB(배포)는 셸에 DATABASE_URL을 주고 --from-shell을 붙일 때만 쓴다.
// 판단은 모두 migrate-run.ts에 있다. 여기는 실제 연결을 이어 주기만 한다. 사람만 실행한다(실제 DB에 연결한다).
const FIRST_USER_ARG = 2 // argv[0]은 node, argv[1]은 이 파일이다.
process.exitCode = await runMigration({
  args: process.argv.slice(FIRST_USER_ARG),
  env: process.env,
  shellUrl: process.env.DATABASE_URL,
  readEnvUrl: () => readLocalEnv().DATABASE_URL,
  readLocal: () => localMigrations(migrationsFolder),
  connect: url => {
    const client = postgres(url, {
      max: 1,
      ssl: { rejectUnauthorized: true },
      connect_timeout: 15,
      onnotice: () => {},
    })
    return {
      query: async text => [...(await client.unsafe(text))],
      apply: () => migrate(drizzle(client), { migrationsFolder }),
      end: () => client.end({ timeout: 5 }),
    }
  },
  log: { info: line => console.log(line), error: line => console.error(line) },
})
