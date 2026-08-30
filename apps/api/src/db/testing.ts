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

// **한 번만 띄운다.** 띄우는 데 7초쯤 걸리는데 검사 파일마다 띄우면 그것만으로
// 게이트의 시간 예산을 먹는다. 표를 통째로 지우고 다시 만드는 것은 100ms가 안 되므로,
// 파일마다 얻는 깨끗함은 그대로 두고 값만 뺀다.
let shared: PGlite | null = null

export async function freshDb() {
  shared ??= new PGlite()
  const pg = shared
  // 앞의 검사가 남긴 것을 통째로 지운다. 지우지 않으면 검사 사이에 값이 새고,
  // 새는 값은 '이 검사만 돌리면 통과하는데 같이 돌리면 깨진다'로 나타난다.
  await pg.exec('drop schema public cascade; create schema public;')
  await pg.exec(SCHEMA_SQL)
  // 닫지 않는다 — 다음 검사가 그대로 쓴다. 프로세스가 끝나면 함께 사라진다.
  return { db: drizzle(pg, { schema }), close: async () => {} }
}
