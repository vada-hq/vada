import type { SmokeConnection } from '../db/pg-smoke-connection.js'
import type { TestDb } from '../db/test-db.js'

// 시험 DB(PGlite)를 점검 도구의 연결 모양으로 감싼다. 연결이 하나뿐이라 end는 닫지 않는다(시험이 close로 닫는다).
export function pgliteConnection(testDb: TestDb): SmokeConnection {
  return {
    db: testDb.db,
    sql: {
      unsafe: async (text, params) =>
        (await testDb.pg.query<Record<string, unknown>>(text, params)).rows,
    },
    end: () => Promise.resolve(),
  }
}
