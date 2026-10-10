import { and, eq, gte, isNotNull, lte, or, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { budgetLines, budgetPeriods } from '../db/schema.js'
import { ApiError } from '../http/errors.js'

type Executor = Pick<PgDatabase<PgQueryResultHKT>, 'execute'>
type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
// advisory lock 키에는 학생회 ID만 쓴다.
const budgetKey = (organizationId: string) => sql`hashtextextended(${JSON.stringify(['budget', organizationId])}, 0)`

// 학생회 하나의 예산 구조 변경(기간 만들기·편성 수정·마감·다시 열기)을 한 줄로 세운다.
// 그래서 겹침·이름·행사 중복·마감 조건을 미리 조회해도 다른 요청이 끼어들지 못한다.
export async function lockBudget(tx: Executor, organizationId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${budgetKey(organizationId)})`)
}
// 지출 변경은 같은 잠금을 같이 잡는다. 마감이 증빙·남은 돈을 세는 동안 지출이 바뀌지 않고, 마감 뒤의 지출 변경은 마감을 본다.
// 재정 권한 확인 바로 뒤에 잡아 잠금 순서(학생회 예산 → 지출 행 → 기간 행 → 행사 행)를 맞춘다.
export async function shareBudget(tx: Executor, organizationId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(${budgetKey(organizationId)})`)
}
// 상시 운영 지출의 결제일. 행사 지출은 날짜가 아니라 행사 정산 잠금이 막는다.
export const operatingDays = (...states: { eventId: string | null; paidOn: string }[]) =>
  states.flatMap(state => state.eventId === null ? [state.paidOn] : [])
// 결제일이 마감한 기간 안이면 상시 운영 지출을 바꾸지 않는다. 같이 잡는 예산 잠금 안에서 본다(이미 잡았으면 한 번 더 잡아도 된다).
export async function requireOpenDays(tx: Executor & Reader, organizationId: string, days: string[]) {
  await shareBudget(tx, organizationId)
  if (!days.length) return
  const [closed] = await tx.select({ id: budgetPeriods.id }).from(budgetPeriods).where(and(eq(budgetPeriods.organizationId, organizationId),
    isNotNull(budgetPeriods.closedAt), or(...days.map(day => and(lte(budgetPeriods.startsOn, day), gte(budgetPeriods.endsOn, day)))))).limit(1)
  if (closed) throw new ApiError('PERIOD_CLOSED', 409)
}
// 행사가 든 기간이 마감됐으면 막는다. 기간 행을 FOR SHARE로 잠가 마감(FOR UPDATE)과 겹치지 않게 하고, 행사 행보다 먼저 잠근다(기간 → 행사).
// 잠근 기간을 돌려주고, 기간에 넣지 않은 행사면 null이다. 정산은 이 기간에 참가비 수입을 넣는다.
export async function requireOpenEventPeriod(tx: Reader, organizationId: string, eventId: string) {
  const [line] = await tx.select({ periodId: budgetLines.periodId }).from(budgetLines)
    .where(and(eq(budgetLines.organizationId, organizationId), eq(budgetLines.eventId, eventId)))
  if (!line) return null
  const [period] = await tx.select().from(budgetPeriods).where(eq(budgetPeriods.id, line.periodId)).for('share')
  if (period?.closedAt) throw new ApiError('PERIOD_CLOSED', 409)
  return period ?? null
}
