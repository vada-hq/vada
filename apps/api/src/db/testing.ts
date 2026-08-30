import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema.ts'
import { SCHEMA_SQL } from './schema-sql.ts'

// **검사가 진짜 Postgres를 쓴다.**
//
// 흉내 낸 저장소로 검사하면 흉내가 틀린 곳을 영원히 못 본다 — 실제로 도는 것은
// 그 저장소가 아니기 때문이다. PGlite는 WASM으로 옮긴 진짜 Postgres라 프로세스
// 안에서 돌고, 도커도 설치도 필요 없다. 그래서 게이트가 이것을 돌릴 수 있다.
//
// 표를 만드는 SQL은 `schema.ts`에서 만들어진 것 하나다(`npm run db:schema`) —
// 손으로 두 벌을 들면 검사가 도는 표와 실제 표가 갈린다.

export async function freshDb() {
  const pg = new PGlite()
  await pg.exec(SCHEMA_SQL)
  return { db: drizzle(pg, { schema }), close: () => pg.close() }
}
