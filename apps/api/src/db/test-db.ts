import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { migrationsFolder } from '../ops/migrate/migrations-folder.js'

// 시험이 마이그레이션 폴더를 이 모듈에서 가져다 쓰므로 그대로 다시 내보낸다.
export { migrationsFolder }

// 마이그레이션을 적용한 DB를 프로세스마다 한 번 만들어 떠 둔다. 새 DB를 처음부터 만들면 이 PC에서 8초쯤 걸리고, 뜬 것을 불러오면 2초쯤 걸린다.
let template: Promise<File | Blob> | undefined
async function migratedTemplate() {
  const pg = await PGlite.create({ extensions: { btree_gist } })
  try {
    await migrate(drizzle(pg), { migrationsFolder })
    return await pg.dumpDataDir('none')
  } finally {
    await pg.close()
  }
}

// 시험 DB. 새 표는 btree_gist 확장이 필요해 new PGlite() 대신 이 도우미만 쓴다(바탕 spec).
// 마이그레이션을 모두 적용한 빈 DB를 시험마다 따로 돌려준다. 다 쓰면 close()로 닫는다.
export async function createTestDb() {
  template ??= migratedTemplate()
  const pg = await PGlite.create({ loadDataDir: await template, extensions: { btree_gist } })
  const db = drizzle(pg)
  return { pg, db, close: () => pg.close() }
}
export type TestDb = Awaited<ReturnType<typeof createTestDb>>

// 이미 있는 행을 바꾸는 마이그레이션의 시험 DB. tag 바로 앞까지 적용한 DB를 주고, applyTarget()이 tag 하나를 적용한다.
// 다 쓰면 pg.close()로 닫는다.
export async function migratedUntil(tag: string) {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
  ) as {
    entries: { tag: string }[]
  }
  const index = journal.entries.findIndex(entry => entry.tag === tag)
  if (index <= 0) throw new Error(`앞 마이그레이션이 없는 태그: ${tag}`)
  const migrations = readMigrationFiles({ migrationsFolder })
  const pg = await PGlite.create({ extensions: { btree_gist } })
  const run = async (from: number, to: number) => {
    for (const migration of migrations.slice(from, to))
      for (const statement of migration.sql) await pg.exec(statement)
  }
  await run(0, index)
  return { pg, applyTarget: () => run(index, index + 1) }
}
