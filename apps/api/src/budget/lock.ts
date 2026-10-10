import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

type Executor = Pick<PgDatabase<PgQueryResultHKT>, 'execute'>
// advisory lock 키에는 학생회 ID만 쓴다.
const budgetKey = (organizationId: string) => sql`hashtextextended(${JSON.stringify(['budget', organizationId])}, 0)`

// 학생회 하나의 예산 구조 변경(기간 만들기·편성 수정·마감·다시 열기)을 한 줄로 세운다.
// 그래서 겹침·이름·행사 중복·마감 조건을 미리 조회해도 다른 요청이 끼어들지 못한다.
export async function lockBudget(tx: Executor, organizationId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${budgetKey(organizationId)})`)
}
