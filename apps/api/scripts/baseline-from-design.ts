// 첫 마이그레이션 apps/api/migrations/0000_baseline.sql을 만든다. 바탕에서 한 번 돌리고 결과를 커밋한다.
// 이 뒤로 표를 바꿀 때는 이 스크립트를 쓰지 않는다. physical-model.md를 먼저 고치고 drizzle-kit generate --custom으로 새 마이그레이션을 쓴다.
// 사용법(apps/api에서): npx tsx scripts/baseline-from-design.ts [physical-model.md 경로]
// 경로를 주지 않으면 이 저장소 옆 폴더 ../vada-docs/physical-model.md를 읽는다.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baselineOf } from './design-sql.js'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const designPath = process.argv[2] ? resolve(process.argv[2]) : resolve(repoRoot, '../vada-docs/physical-model.md')
const output = fileURLToPath(new URL('../migrations/0000_baseline.sql', import.meta.url))
writeFileSync(output, baselineOf(readFileSync(designPath, 'utf8')))
console.log(`0000_baseline.sql을 만들었다: ${designPath}`)
