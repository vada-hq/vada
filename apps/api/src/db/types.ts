import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// 드라이버(postgres-js, PGlite)와 상관없는 DB 핸들과 거래 핸들 타입. 기록 모듈이 아닌 쪽도 같이 쓴다.
export type Db = PgDatabase<PgQueryResultHKT>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
