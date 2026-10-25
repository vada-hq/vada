// 하위 에이전트의 PreToolUse(Bash) 훅. 실제 DB에 닿는 명령을 돌리려 할 때만 막는다.
// 명령 글자에 이름이 들어 있기만 한 경우(grep, git mv, 린트, 시험)는 막지 않는다.
// 막을 때는 2로 끝내고 까닭을 stderr에 쓴다. Claude Code가 그 글을 에이전트에게 돌려준다.

const BLOCK = 2

// 한 명령 안에서만 본다. ; & | 줄바꿈을 넘으면 다른 명령이다.
const SAME_COMMAND = String.raw`[^;&|\n]*`

const DB_COMMANDS = [
  // pnpm --filter @vada/api db:migrate, pnpm run demo, npm run test-data. pnpm은 run 없이도 스크립트를 돌린다.
  // 스크립트 이름은 따로 선 낱말일 때만 본다(pg-smoke-cases.ts 같은 파일 이름은 둔다).
  String.raw`\b(npm|pnpm|yarn)\b${SAME_COMMAND}(?<![\w/.-])(db:migrate|test-data|pg-smoke|demo|president-recovery)(?![\w/.:-])`,
  // tsx src/ops/migrate/migrate.ts, pnpm exec tsx scripts/manage-test-data.ts, tsx scripts/manage-president-recovery.ts, node … pg-smoke.ts
  String.raw`\b(tsx|node|ts-node|bun)\b${SAME_COMMAND}(\bmigrate|manage-test-data|manage-demo-data|manage-president-recovery|\bpg-smoke)\.ts\b`,
  // drizzle-kit push·migrate·drop은 DB에 바로 쓴다. generate는 파일만 만든다.
  String.raw`\bdrizzle-kit\b${SAME_COMMAND}\b(push|migrate|drop)\b`,
].map(source => new RegExp(source))

let text = ''
for await (const chunk of process.stdin) text += chunk
const command = String(JSON.parse(text)?.tool_input?.command ?? '')

if (DB_COMMANDS.some(pattern => pattern.test(command))) {
  process.stderr.write(
    '실제 DB에 닿는 명령(db:migrate, test-data, demo, president-recovery, pg-smoke, drizzle-kit push)은 진행 에이전트만 돌린다.\n',
  )
  process.exit(BLOCK)
}
