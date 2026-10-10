import { and, eq, gte, isNull, lt, sql, type SQL } from 'drizzle-orm'
import type { PgColumn, PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { koreanOf, type FeeAccount } from '@vada/contracts'
import { duesMembers, duesRosters, feeAccounts, registrations } from '../db/schema.js'

type Db = PgDatabase<PgQueryResultHKT>
type Reader = Pick<Db, 'select'>

// 한국 날짜 "YYYY-MM-DD". 명단의 쓰는 기한은 한국 날짜로 센다.
export const koreanToday = (now: Date) => koreanOf(now).slice(0, 10)
// 이름 비교 열쇠: 공백을 빼고 영문 대소문자를 가리지 않는다.
export const nameKey = (value: PgColumn | SQL) => sql`lower(regexp_replace(${value}, '[[:space:]]', '', 'g'))`

// 쓰는 기한이 지난 명단을 지운다. 납부자는 FK CASCADE로 같이 지운다. organizationId를 주면 그 학생회만 본다.
export async function purgeExpiredRosters(db: Pick<Db, 'delete'>, today: string, organizationId?: string) {
  const rows = await db.delete(duesRosters)
    .where(and(lt(duesRosters.useUntil, today), organizationId === undefined ? undefined : eq(duesRosters.organizationId, organizationId)))
    .returning({ organizationId: duesRosters.organizationId })
  return rows.length
}

// 쓰는 기한이 남은 명단의 이름과 기한. 납부자는 알려 주지 않는다.
export async function activeRoster(db: Reader, organizationId: string, today: string) {
  const [row] = await db.select({ label: duesRosters.label, useUntil: duesRosters.useUntil }).from(duesRosters)
    .where(and(eq(duesRosters.organizationId, organizationId), gte(duesRosters.useUntil, today)))
  return row ?? null
}

// 쓰는 기한이 남은 명단에 학번과 이름이 둘 다 맞는 사람이 있는가
export async function isDuesMember(db: Reader, organizationId: string, studentId: string, name: string, today: string) {
  const [row] = await db.select({ studentId: duesMembers.studentId }).from(duesMembers)
    .innerJoin(duesRosters, eq(duesRosters.organizationId, duesMembers.organizationId))
    .where(and(eq(duesMembers.organizationId, organizationId), eq(duesMembers.studentId, studentId), gte(duesRosters.useUntil, today),
      sql`${nameKey(duesMembers.name)} = ${nameKey(sql`${name}`)}`))
    .limit(1)
  return row !== undefined
}

// 참가 신청 하나의 지우지 않은 신청을 지금 명단과 다시 맞춘다. 명단이 없거나 기한이 지났으면 모두 미납자다.
// 하위 질의 안에서 바깥 신청 행을 가리키도록 표 이름을 붙여 쓴다.
export async function rematchDues(db: Pick<Db, 'update'>, organizationId: string, formId: string, today: string) {
  await db.update(registrations).set({ duesMember: sql`EXISTS (SELECT 1 FROM dues_members m
      JOIN dues_rosters r ON r.organization_id = m.organization_id
      WHERE m.organization_id = ${organizationId} AND r.use_until >= ${today} AND m.student_id = "registrations"."student_id"
        AND lower(regexp_replace(m.name, '[[:space:]]', '', 'g')) = lower(regexp_replace("registrations"."name", '[[:space:]]', '', 'g')))` })
    .where(and(eq(registrations.formId, formId), isNull(registrations.purgedAt)))
}

// 참가비를 받는 학생회 계좌
export async function feeAccountOf(db: Reader, organizationId: string): Promise<FeeAccount | null> {
  const [row] = await db.select({ bank: feeAccounts.bank, accountNumber: feeAccounts.accountNumber, holder: feeAccounts.holder }).from(feeAccounts)
    .where(eq(feeAccounts.organizationId, organizationId))
  return row ?? null
}
