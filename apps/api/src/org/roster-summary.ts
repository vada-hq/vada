import { and, count, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  educationColleges,
  educationSchools,
  members,
  organizations,
  rosterUpdates,
  students,
} from '../db/schema.ts'
import { moment } from '../time.ts'

async function lastUpdate(
  db: Db,
  orgId: string,
  kind: string,
): Promise<{ at: Date; by: string | null } | null> {
  const rows = await db
    .select({ at: rosterUpdates.updatedAt, by: members.name })
    .from(rosterUpdates)
    .leftJoin(members, eq(members.id, rosterUpdates.updatedByMemberId))
    .where(and(eq(rosterUpdates.orgId, orgId), eq(rosterUpdates.kind, kind)))
    .orderBy(desc(rosterUpdates.updatedAt))
    .limit(1)
  const row = rows[0]
  return row === undefined ? null : { at: row.at, by: row.by }
}

export interface RosterScope {
  path: string
  note: string
  rosterUpdatedAt: string
  rosterUpdatedBy: string
  duesUpdatedAt: string
  duesUpdatedBy: string
}

export async function rosterScope(db: Db, orgId: string): Promise<RosterScope> {
  const rows = await db
    .select({ schoolName: educationSchools.name, collegeName: educationColleges.name })
    .from(organizations)
    .leftJoin(educationSchools, eq(educationSchools.id, organizations.repSchoolId))
    .leftJoin(
      educationColleges,
      and(
        eq(educationColleges.id, organizations.repCollegeId),
        eq(educationColleges.schoolId, organizations.repSchoolId),
      ),
    )
    .where(eq(organizations.id, orgId))
    .limit(1)
  const row = rows[0]
  const named = [row?.schoolName, row?.collegeName].filter(
    (one): one is string => typeof one === 'string' && one !== '',
  )
  const roster = await lastUpdate(db, orgId, 'roster')
  const dues = await lastUpdate(db, orgId, 'dues')
  const last = named.at(-1)
  return {
    path: named.length === 0 ? '대표 범위 미등록' : named.join(' › '),
    note:
      last === undefined
        ? '대표 범위를 정하면 이 명단에 등록할 수 있는 학생이 정해집니다.'
        : `${last} 학생만 이 명단에 등록할 수 있습니다. 범위 변경은 조직 설정에서 가능합니다.`,
    rosterUpdatedAt: roster === null ? '갱신된 적 없음' : moment(roster.at),
    rosterUpdatedBy: roster === null ? '아직 올린 사람이 없습니다' : `학생 명단 업로드 · ${roster.by ?? '알 수 없음'}`,
    duesUpdatedAt: dues === null ? '갱신된 적 없음' : moment(dues.at),
    duesUpdatedBy: dues === null ? '아직 올린 사람이 없습니다' : `학생회비 명단 업로드 · ${dues.by ?? '알 수 없음'}`,
  }
}

export interface AreaSummaries {
  departments: string
  students: string
  roles: string
}

export async function areaSummaries(db: Db, orgId: string): Promise<AreaSummaries> {
  const one = async (from: typeof students | typeof members) => {
    const rows = await db.select({ total: count() }).from(from).where(eq(from.orgId, orgId))
    return rows[0]?.total ?? 0
  }
  const memberCount = await one(members)
  const studentCount = await one(students)
  const departmentRows = await db
    .select({ total: sql<number>`count(distinct ${members.departmentId})` })
    .from(members)
    .where(eq(members.orgId, orgId))
  const departmentCount = Number(departmentRows[0]?.total ?? 0)
  const roster = await lastUpdate(db, orgId, 'roster')
  return {
    departments: `부서 ${departmentCount}개 · 구성원 ${memberCount}명`,
    students:
      roster === null
        ? `학생 ${studentCount.toLocaleString('ko-KR')}명`
        : `학생 ${studentCount.toLocaleString('ko-KR')}명 · 최근 갱신 ${moment(roster.at).slice(5, 10).replace('-', '.')}`,
    roles: '기본 역할 3종 · 확정된 권한 매트릭스',
  }
}
