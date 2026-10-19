// 설계 검사(로컬): 마이그레이션을 적용한 DB와 physical-model.md의 SQL 블록을 그대로 적용한 DB를 맞댄다(표, 칸, 제약, 인덱스).
// 로그인 표 4개와 설계 밖 표 3개는 빼고 본다. 옆 폴더 vada-docs가 있어야 해서 CI에는 넣지 않는다. 표를 바꿀 때 돌린다.
// 사용법: npm run check:design --workspace @vada/api [-- physical-model.md 경로]
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { createTestDb } from '../src/db/test-db.js'
import { catalogDifferences, describeDatabase } from './catalog.js'
import { designBlock, NOT_IN_DESIGN } from './design-sql.js'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const designPath = process.argv[2] ? resolve(process.argv[2]) : resolve(repoRoot, '../vada-docs/physical-model.md')
const design = await PGlite.create({ extensions: { btree_gist } })
const migrated = await createTestDb()
try {
  await design.exec(designBlock(readFileSync(designPath, 'utf8')))
  const expected = await describeDatabase(design, NOT_IN_DESIGN)
  const { onlyInDesign, onlyInMigration } = catalogDifferences(expected, await describeDatabase(migrated.pg, NOT_IN_DESIGN))
  for (const line of onlyInDesign) console.log(`설계에만 있다: ${line}`)
  for (const line of onlyInMigration) console.log(`마이그레이션에만 있다: ${line}`)
  if (onlyInDesign.length || onlyInMigration.length) {
    console.log('설계와 마이그레이션이 다르다. physical-model.md를 먼저 고쳤는지, 새 마이그레이션이 같은 SQL인지 확인한다.')
    process.exitCode = 1
  } else {
    console.log(`설계와 같다: ${expected.filter(line => line.startsWith('표 ')).length}개 표 (${designPath})`)
  }
} finally {
  await design.close()
  await migrated.close()
}
