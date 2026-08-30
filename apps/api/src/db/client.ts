import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.ts'

// 저장소에 닿는 자리.
//
// **연결을 상시로 둔다.** Lambda가 요청마다 연결을 여는 모양을 버리고 늘 켜진
// 계산을 고른 까닭이 이것이다(docs/decisions/backend-architecture.md) — 풀이 상시라
// 연결 수가 문제가 되지 않고 RDS Proxy가 필요 없다.

export type Db = ReturnType<typeof drizzlePostgres<typeof schema>>

export function connect(url: string): Db {
  return drizzlePostgres(postgres(url, { max: 10 }), { schema })
}
