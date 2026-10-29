import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { readLocalEnv } from '../src/local-env.js'
import { withoutSeparator } from '../src/ops/script-args.js'
import { scriptStorage } from '../src/ops/script-storage.js'
import { runShowcaseCommand } from './showcase-command.js'

// 사용법(저장소 맨 위에서):
//   pnpm --filter @vada/api showcase --president <user-id> [--finance-head <user-id>] [--planning-head <user-id>]
//     [--school '<학교 이름>'] [--council '<학생회 이름>'] [--apply] [--from-shell]
// 시연 학생회 한 벌(src/flows/showcase/content)을 만든다. 기본은 미리 보기다(대상과 만들 개수만 보이고 아무것도 쓰지 않는다).
// 대상은 .env의 DB이고, 배포 DB는 셸에 DATABASE_URL을 주고 --from-shell을 붙인다.
// 판단은 모두 showcase-command.ts에 있다. 여기는 실제 연결을 이어 주기만 한다. 사람만 실행한다(실제 DB에 연결한다).
const FIRST_USER_ARG = 2 // argv[0]은 node, argv[1]은 이 파일이다.
process.exitCode = await runShowcaseCommand({
  args: withoutSeparator(process.argv.slice(FIRST_USER_ARG)),
  env: process.env,
  shellUrl: process.env.DATABASE_URL,
  readEnvUrl: () => readLocalEnv().DATABASE_URL,
  connect: url => {
    const client = postgres(url, {
      max: 1,
      ssl: { rejectUnauthorized: true },
      connect_timeout: 15,
      onnotice: () => {},
    })
    return { db: drizzle(client), end: () => client.end({ timeout: 5 }) }
  },
  storage: scriptStorage(),
  now: () => new Date(),
  log: { info: line => console.log(line), error: line => console.error(line) },
})
