import { and, asc, eq, exists, isNull, or, sql } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { TeamResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  councilMembership,
  department,
  departmentMembership,
  meeting,
  member,
  task,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { joinedDisplayNameOf } from './display-name.js'

// 쓰인 부서: 한 번이라도 소속이 있었거나(끝난 소속, 지난 기수 포함) 업무나 회의가 가리킨다. 이런 부서는 지우면
// 기록이 끊기므로(없애기는 외래 키로 막힌다) '그만 쓰기'이고, 쓰이지 않은 부서만 '없애기'다(DEC-91).
async function usedDepartments(db: Pick<Db, 'select'>, councilId: string) {
  const refers = (table: PgTable, column: AnyPgColumn) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(table)
        .where(eq(column, department.id)),
    )
  const rows = await db
    .select({ id: department.id })
    .from(department)
    .where(
      and(
        eq(department.councilId, councilId),
        or(
          refers(departmentMembership, departmentMembership.departmentId),
          refers(task, task.departmentId),
          refers(meeting, meeting.hostDepartmentId),
        ),
      ),
    )
  return new Set(rows.map(row => row.id))
}

// 운영진과 부서 목록. 지금 기수의 끝나지 않은 소속만 보인다. 들어온 순서대로 놓고, 이메일은 넣지 않는다(바탕 spec G12).
export async function teamOf(db: Pick<Db, 'select'>, actor: Actor): Promise<TeamResponse> {
  const members = await db
    .select({
      id: member.id,
      name: joinedDisplayNameOf(member, actor.councilId),
      councilRank: councilMembership.councilRank,
      joinedAt: councilMembership.startsAt,
    })
    .from(councilMembership)
    .innerJoin(member, eq(member.id, councilMembership.memberId))
    .where(and(eq(councilMembership.cohortId, actor.cohortId), isNull(councilMembership.endsAt)))
    .orderBy(asc(councilMembership.startsAt), asc(member.id))
  const placements = await db
    .select({
      memberId: departmentMembership.memberId,
      departmentId: departmentMembership.departmentId,
      rank: departmentMembership.departmentRank,
    })
    .from(departmentMembership)
    .where(
      and(eq(departmentMembership.cohortId, actor.cohortId), isNull(departmentMembership.endsAt)),
    )
    .orderBy(asc(departmentMembership.departmentId))
  // 그만 쓴 부서는 목록과 고르는 칸에서 빠진다(DEC-91). 기록과 지난 기간 보기는 그 기록에서 부서를 직접 읽는다.
  const departments = await db
    .select({ id: department.id, name: department.name, role: department.role })
    .from(department)
    .where(and(eq(department.councilId, actor.councilId), isNull(department.retiredAt)))
    .orderBy(asc(department.id))
  const used = await usedDepartments(db, actor.councilId)
  return {
    members: members.map(row => ({
      id: row.id,
      name: row.name,
      councilRank: row.councilRank,
      joinedAt: row.joinedAt.toISOString(),
      departments: placements
        .filter(item => item.memberId === row.id)
        .map(item => ({ id: item.departmentId, rank: item.rank })),
    })),
    departments: departments.map(row => ({
      ...row,
      memberCount: placements.filter(item => item.departmentId === row.id).length,
      used: used.has(row.id),
    })),
  }
}
