import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HOOK = fileURLToPath(new URL('./block-db-commands.mjs', import.meta.url))
const BLOCK = 2

function exitCodeFor(command) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command } })
  return spawnSync(process.execPath, [HOOK], { input }).status
}

const blocked = [
  'npm run db:migrate --workspace @vada/api',
  'npm run db:migrate --workspace @vada/api -- --apply',
  'npm -w @vada/api run test-data -- seed x',
  'cd apps/api && npm run pg-smoke',
  'echo a; npm run pg-smoke',
  'npx tsx src/ops/migrate/migrate.ts',
  'npx tsx scripts/pg-smoke.ts',
  'tsx scripts/manage-test-data.ts seed',
  'npx drizzle-kit push',
]

const allowed = [
  'grep -rn pg-smoke apps/api',
  'git mv apps/api/scripts/pg-smoke.ts apps/api/src/ops/pg-smoke.ts',
  'npx oxlint apps/api/scripts/pg-smoke-cases.ts',
  'npx tsx --test src/ops/migrate/migrate.test.ts',
  'npm run db:generate --workspace @vada/api',
  'npm test --workspace @vada/api',
  'cat scripts/manage-test-data.ts | head',
  'echo db:migrate',
  'out=$(git diff --stat); echo $? ; for f in a b; do echo $f; done',
]

for (const command of blocked) {
  test(`막는다: ${command}`, () => assert.equal(exitCodeFor(command), BLOCK))
}

for (const command of allowed) {
  test(`둔다: ${command}`, () => assert.equal(exitCodeFor(command), 0))
}
