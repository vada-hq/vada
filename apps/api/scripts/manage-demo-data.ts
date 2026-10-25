import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { readLocalEnv } from '../src/local-env.js'
import { withoutSeparator } from '../src/ops/script-args.js'
import { createR2Storage, r2ConfigFrom } from '../src/storage/storage.js'
import { runDemo } from './demo-command.js'

// 사용법(저장소 맨 위에서, 플래그 앞의 --를 빠뜨리지 않는다):
//   pnpm --filter @vada/api demo <user-id> [--apply] [--from-shell]
// 시연 학생회를 넣는다. 기본은 미리 보기다(대상과 넣을 것만 보이고 아무것도 쓰지 않는다). 대상은 .env의 DB이고, 배포 DB는 셸에 DATABASE_URL을 주고 --from-shell을 붙인다.
// 판단은 모두 demo-command.ts에 있다. 여기는 실제 연결을 이어 주기만 한다. 사람만 실행한다(실제 DB에 연결한다).
// 증빙 저장소(R2) 값은 셸이 .env보다 앞선다. .env가 없어도 셸에 있으면 된다. 값은 읽어 쓰기만 하고 찍지 않는다.
function storageOf() {
  let fileEnv: NodeJS.ProcessEnv = {}
  try {
    fileEnv = readLocalEnv()
  } catch {
    // .env가 없으면 셸의 값만 쓴다.
  }
  const config = r2ConfigFrom({ ...fileEnv, ...process.env })
  return config ? createR2Storage(config) : null
}

const FIRST_USER_ARG = 2 // argv[0]은 node, argv[1]은 이 파일이다.
process.exitCode = await runDemo({
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
  storage: storageOf(),
  now: () => new Date(),
  log: { info: line => console.log(line), error: line => console.error(line) },
})
