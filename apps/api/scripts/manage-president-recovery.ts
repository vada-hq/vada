import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { readLocalEnv } from '../src/local-env.js'
import { withoutSeparator } from '../src/ops/script-args.js'
import { runPresidentRecovery } from './president-recovery-command.js'

// 사용법(저장소 맨 위에서):
//   pnpm --filter @vada/api president-recovery <학생회 id> <새 회장 이메일> --notified-on <YYYY-MM-DD> [--apply] [--from-shell]
// 회장이 연락이 끊겼을 때 회장 직급을 옮긴다(DEC-57). 절차 문서(vada-docs pilot/)의 확인을 마친 뒤에만 돌린다.
// 기본은 미리 보기다(대상, 학생회, 지금 회장과 새 회장, 점검만 보이고 쓰지 않는다). 대상은 .env의 DB이고, 배포 DB는 셸에 DATABASE_URL을 주고 --from-shell을 붙인다.
// 판단은 모두 president-recovery-command.ts에 있다. 여기는 실제 연결을 이어 주기만 한다.
// 운영 DB(--from-shell)에서는 DEC-56 접근자 명단의 사람이 학생회 요청(예외 1) 아래 돌린다. 진행 에이전트는 개발 DB에서만 돌린다.
const FIRST_USER_ARG = 2 // argv[0]은 node, argv[1]은 이 파일이다.
process.exitCode = await runPresidentRecovery({
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
  now: () => new Date(),
  log: { info: line => console.log(line), error: line => console.error(line) },
})
