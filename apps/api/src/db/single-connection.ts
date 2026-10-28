import { PGlite } from '@electric-sql/pglite'

// 연결이 하나뿐인 DB 클라이언트. 연결 전체에 거는 설정(시나리오 시계의 connection 범위)은 이런 클라이언트에만 건다.
// PGlite는 늘 하나다. 진짜 Postgres 시험 DB(test-support/real-postgres.ts)는 max 1인 postgres.js 클라이언트를 여기 적는다.
// 연결 수(options.max)만 보고 받지 않는다. 운영 코드가 max 1 클라이언트를 만들어도 풀러를 거치면 다른 클라이언트에 샌다.
const marked = new WeakSet<object>()

export function markSingleConnection(client: object) {
  marked.add(client)
}

// WeakSet.has는 객체가 아닌 값에 false를 돌려준다(postgres.js 클라이언트는 함수다).
export const isSingleConnection = (client: unknown) =>
  client instanceof PGlite || marked.has(client as object)
