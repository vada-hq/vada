import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import type { DrizzleConfig } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { migrationsFolder } from '../ops/migrate/migrations-folder.js'
import { postgresEmptyDb, postgresTestDb } from '../test-support/real-postgres.js'
import type { Db } from './types.js'

// 시험이 마이그레이션 폴더를 이 모듈에서 가져다 쓰므로 그대로 다시 내보낸다.
export { migrationsFolder }

// 시험이 SQL을 바로 쓰는 연결. PGlite와 진짜 Postgres(test-support/real-postgres.ts)가 같은 모양으로 준다.
export interface TestPg {
  // oxlint-disable-next-line typescript/no-explicit-any -- PGlite query의 기본 행 타입과 같다(시험이 칸을 바로 읽는다).
  query<T = Record<string, any>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows?: number; rowCount?: number }>
  exec(text: string): Promise<unknown>
  close(): Promise<void>
}
export interface TestDb {
  pg: TestPg
  db: Db
  // 같은 연결에 설정(쿼리 logger 등)만 달리한 drizzle. 시험이 드라이버를 몰라도 되게 여기서 만든다.
  drizzle: (config: DrizzleConfig) => Db
  close: () => Promise<void>
}

// db.execute의 결과 모양은 드라이버마다 다르다(postgres.js는 행 배열, PGlite는 { rows }). 시험은 이것으로 행을 꺼낸다.
export const rowsOf = <T>(result: unknown) =>
  (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[]

// TEST_DATABASE_URL이 있으면 운영과 같은 드라이버(postgres.js)와 진짜 Postgres로 돈다(CI). 없으면 PGlite다(로컬 기본값).
// PGlite는 raw SQL에 넘긴 Date처럼 운영 드라이버가 받지 않는 것을 받아 줘서, 그런 결함은 진짜 Postgres에서만 드러난다(fba9e77d).
const realPostgresUrl = process.env.TEST_DATABASE_URL

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
export async function createTestDb(): Promise<TestDb> {
  if (realPostgresUrl) return postgresTestDb(realPostgresUrl)
  template ??= migratedTemplate()
  const pg = await PGlite.create({ loadDataDir: await template, extensions: { btree_gist } })
  return {
    pg,
    db: drizzle(pg),
    drizzle: config => drizzle(pg, config),
    close: () => pg.close(),
  }
}

// 이미 있는 행을 바꾸는 마이그레이션의 시험 DB. tag 바로 앞까지 적용한 DB를 주고, applyTarget()이 tag 하나를 적용한다.
// 다 쓰면 pg.close()로 닫는다.
export async function migratedUntil(tag: string): Promise<{
  pg: TestPg
  db: Db
  applyTarget: () => Promise<void>
}> {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
  ) as {
    entries: { tag: string }[]
  }
  const index = journal.entries.findIndex(entry => entry.tag === tag)
  if (index <= 0) throw new Error(`앞 마이그레이션이 없는 태그: ${tag}`)
  const migrations = readMigrationFiles({ migrationsFolder })
  const { pg, db } = realPostgresUrl ? await postgresEmptyDb(realPostgresUrl) : await emptyPglite()
  const run = async (from: number, to: number) => {
    for (const migration of migrations.slice(from, to))
      for (const statement of migration.sql) await pg.exec(statement)
  }
  await run(0, index)
  return { pg, db, applyTarget: () => run(index, index + 1) }
}

async function emptyPglite() {
  const pg = await PGlite.create({ extensions: { btree_gist } })
  return { pg, db: drizzle(pg) }
}
