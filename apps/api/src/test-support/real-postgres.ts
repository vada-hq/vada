import { createHash, randomBytes } from 'node:crypto'
import { types } from '@electric-sql/pglite'
import type { DrizzleConfig } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { TestDb, TestPg } from '../db/test-db.js'
import { markSingleConnection } from '../db/single-connection.js'
import { migrationsFolder } from '../ops/migrate/migrations-folder.js'

// 진짜 Postgres 시험 DB(TEST_DATABASE_URL). 운영과 같은 드라이버(postgres.js)와 서버로 돈다.
// PGlite 도우미와 뜻을 맞춘다: 마이그레이션을 다 적용한 빈 DB를 시험마다 따로 주고, 연결은 하나다(연결 설정·시나리오 시계가 시험 안에서 이어진다).
// DB는 마이그레이션 내용마다 한 번 만든 틀 DB에서 CREATE DATABASE ... TEMPLATE로 복사하고, close()가 지운다.

const quiet = { onnotice: () => {} }

const urlOf = (base: string, database: string) => {
  const url = new URL(base)
  url.pathname = `/${database}`
  return url.toString()
}

// DB를 만들고 지우는 관리 연결. 1초 쉬면 닫혀, 시험이 끝난 프로세스가 열린 연결 때문에 남지 않는다.
let admin: postgres.Sql | undefined
const adminOf = (url: string) => (admin ??= postgres(url, { ...quiet, max: 1, idle_timeout: 1 }))
// 이름은 이 파일이 [a-z0-9_]로만 만든다. CREATE·DROP DATABASE는 매개변수를 받지 않는다.
const ddl = async (url: string, statement: string) => {
  await adminOf(url).unsafe(statement).simple()
}

function templateName() {
  const hash = createHash('sha256')
  for (const migration of readMigrationFiles({ migrationsFolder })) hash.update(migration.hash)
  return `vada_test_template_${hash.digest('hex').slice(0, 12)}`
}

// 시험 파일은 프로세스마다 나란히 돈다. 틀 DB는 거래 수준 advisory lock 아래 한 프로세스만 만든다.
// 다른 이름으로 다 만든 뒤 이름을 바꿔, 중간에 멈춘 틀을 다른 프로세스가 복사하지 않는다.
const TEMPLATE_LOCK = 4_212_026
async function ensureTemplate(url: string) {
  const name = templateName()
  const lock = postgres(url, { ...quiet, max: 1 })
  try {
    await lock.begin(async tx => {
      await tx`select pg_advisory_xact_lock(${TEMPLATE_LOCK})`
      const found = await tx`select 1 from pg_database where datname = ${name}`
      if (found.length > 0) return
      const building = `${name}_build`
      await ddl(url, `DROP DATABASE IF EXISTS "${building}" WITH (FORCE)`)
      await ddl(url, `CREATE DATABASE "${building}"`)
      const client = postgres(urlOf(url, building), { ...quiet, max: 1 })
      try {
        await migrate(drizzle(client), { migrationsFolder })
      } finally {
        await client.end()
      }
      await ddl(url, `ALTER DATABASE "${building}" RENAME TO "${name}"`)
    })
  } finally {
    await lock.end()
  }
  return name
}

// 시험이 SQL을 바로 쓰는 연결도 PGlite가 주던 값 모양을 지킨다. drizzle은 운영처럼 시각 값을 글자로 받게 클라이언트를 바꾸지만
// (drizzle-orm/postgres-js의 transparentParser), 시험의 SQL은 PGlite처럼 Date·숫자를 받던 대로 둔다.
const INT8 = 20
const INT8_ARRAY = 1016
const DATE_TYPES = new Set([1082, 1114, 1184])
const DATE_ARRAY_ELEMENT = new Map([
  [1182, 1082],
  [1115, 1114],
  [1185, 1184],
])

// 드라이버가 글자로 준 값만 PGlite의 해석기로 다시 읽는다(int8, date·timestamp·timestamptz와 그 배열).
function pgliteValue(value: unknown, type: number): unknown {
  const element = DATE_ARRAY_ELEMENT.get(type)
  if (typeof value === 'string' && (type === INT8 || DATE_TYPES.has(type)))
    return types.parseType(value, type) as unknown
  if (typeof value === 'string' && element !== undefined)
    return types.arrayParser(
      value,
      text => types.parseType(text, element) as unknown,
      type,
    ) as unknown
  if (type === INT8_ARRAY && Array.isArray(value))
    return value.map(item =>
      typeof item === 'string' ? (types.parseType(item, INT8) as unknown) : (item as unknown),
    )
  return value
}

// PGlite처럼 Date는 ISO 글자로, 객체는 JSON으로 보낸다. drizzle이 시각 직렬화를 꺼 둔 클라이언트라 Date를 그대로 넘기면 던진다.
function wireValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(wireValue)
  if (value !== null && typeof value === 'object' && !(value instanceof Uint8Array))
    return JSON.stringify(value)
  return value
}

function testPgOf(client: postgres.Sql, close: () => Promise<void>): TestPg {
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const result = await client.unsafe(
        text,
        params.map(wireValue) as postgres.ParameterOrJSON<never>[],
      )
      const rows = result.map(row => {
        const record = row as Record<string, unknown>
        for (const column of result.columns ?? [])
          record[column.name] = pgliteValue(record[column.name], column.type)
        return record
      })
      return { rows: rows as T[], affectedRows: result.count, rowCount: result.count }
    },
    async exec(text: string) {
      await client.unsafe(text).simple()
    },
    close,
  }
}

function open(url: string, name: string): TestDb {
  const client = postgres(urlOf(url, name), { ...quiet, max: 1 })
  markSingleConnection(client)
  let closed: Promise<void> | undefined
  const close = () =>
    (closed ??= (async () => {
      await client.end()
      await ddl(url, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    })())
  return {
    pg: testPgOf(client, close),
    db: drizzle(client),
    drizzle: (config: DrizzleConfig) => drizzle(client, config),
    close,
  }
}

let template: Promise<string> | undefined
let counter = 0
const freshName = () => {
  counter += 1
  return `vada_test_${process.pid}_${counter}_${randomBytes(3).toString('hex')}`
}

export async function postgresTestDb(url: string): Promise<TestDb> {
  template ??= ensureTemplate(url)
  const source = await template
  const name = freshName()
  await ddl(url, `CREATE DATABASE "${name}" TEMPLATE "${source}"`)
  return open(url, name)
}

// 마이그레이션을 tag 바로 앞까지 적용한 빈 DB(test-db.ts migratedUntil의 진짜 Postgres 쪽).
export async function postgresEmptyDb(url: string): Promise<TestDb> {
  const name = freshName()
  await ddl(url, `CREATE DATABASE "${name}"`)
  return open(url, name)
}
