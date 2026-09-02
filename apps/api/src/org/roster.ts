import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
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

// 학생 명단(ORG-07A)과 그 곁의 셋.
//
// **이 명단은 학생회 구성원이 아니다.** 단과대학 학생 전체이고, 행사 참가 확인과
// 학생회비 조회에 쓴다 — 그래서 `members`와 다른 표다(ORG-00의 카드가 그렇게 말한다).
//
// **거르는 것도 세는 것도 서버가 한다.** 천 명짜리 명단을 통째로 보내면 화면이 그것을
// 들고 거르게 되고, 그때부터 '몇 명인가'의 답이 화면마다 갈린다.

/** 한 쪽에 몇 줄. 명세가 쪽 수를 요구하므로 어딘가는 이 수를 알아야 한다. */
const PER_PAGE = 20

/**
 * 학생회비 상태를 **완성된 글과 색으로** 준다.
 *
 * 표에는 `paid`·`unpaid`·`check`가 있고 사람이 읽는 말은 여기서 붙는다. 화면이 옮기면
 * 화면마다 다른 말이 나온다 — 이 저장소가 역할 이름도 서버에서 주는 것과 같은 까닭이다.
 *
 * **줄 색은 손봐야 하는 줄에만 붙는다.** 전부에 붙이면 아무것도 눈에 띄지 않는다.
 */
const DUES: Record<string, { label: string; tone: string; rowTone: string }> = {
  paid: { label: '납부', tone: 'green', rowTone: '' },
  unpaid: { label: '미납', tone: 'red', rowTone: '' },
  check: { label: '확인 필요', tone: 'yellow', rowTone: 'yellow' },
}

export interface RosterQuery {
  query?: string
  grade?: string
  duesStatus?: string
  page?: string
}

/**
 * 거르는 조건.
 *
 * **'전체'는 거르지 않는다는 뜻이다.** 화면의 거르개가 그 값을 보내고, 그것을 그대로
 * 상태로 읽으면 아무도 안 나온다.
 */
function narrowing(orgId: string, asked: RosterQuery) {
  const parts = [eq(students.orgId, orgId)]
  const query = (asked.query ?? '').trim()
  if (query !== '') {
    // 이름으로도 학번으로도 찾는다 — 사람은 둘 중 아는 것을 넣는다.
    parts.push(
      or(ilike(students.name, `%${query}%`), ilike(students.studentNumber, `%${query}%`))!,
    )
  }
  const grade = (asked.grade ?? '').trim()
  if (grade !== '' && grade !== 'all') parts.push(eq(students.grade, grade))

  const dues = (asked.duesStatus ?? '').trim()
  if (dues !== '' && dues !== 'all' && dues in DUES) {
    parts.push(eq(students.duesStatus, dues as 'paid' | 'unpaid' | 'check'))
  }
  return and(...parts)
}

export interface StudentRow {
  id: string
  name: string
  studentNumber: string
  college: string
  department: string
  grade: string
  duesLabel: string
  duesTone: string
  rowTone: string
}

/** 명단 한 쪽. **거른 뒤의 것**이고, 쪽 수는 곁의 자리가 말한다. */
export async function roster(db: Db, orgId: string, asked: RosterQuery): Promise<StudentRow[]> {
  const page = Math.max(1, Number.parseInt(asked.page ?? '1', 10) || 1)
  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      studentNumber: students.studentNumber,
      college: students.college,
      department: students.department,
      grade: students.grade,
      duesStatus: students.duesStatus,
    })
    .from(students)
    .where(narrowing(orgId, asked))
    .orderBy(asc(students.studentNumber))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)

  return rows.map((row) => {
    const dues = DUES[row.duesStatus] ?? DUES.unpaid!
    return {
      id: row.id,
      name: row.name,
      studentNumber: row.studentNumber,
      // **없는 것은 빈 글로 준다.** 명세가 이 조각들을 필수로 적었고, 없다고 줄을
      // 빼면 명단에 있는 사람이 명단에서 사라진다.
      college: row.college ?? '',
      department: row.department ?? '',
      grade: row.grade ?? '',
      duesLabel: dues.label,
      duesTone: dues.tone,
      rowTone: dues.rowTone,
    }
  })
}

export interface RosterPaging {
  totalNote: string
  pageCount: number
}

/**
 * 모두 몇이고 쪽이 몇인가.
 *
 * **거른 뒤에 센다.** 거르기 전 수를 주면 화면이 '총 1,284명'이라 적고 여덟 줄만 그린다.
 */
export async function rosterPaging(
  db: Db,
  orgId: string,
  asked: RosterQuery,
): Promise<RosterPaging> {
  const rows = await db
    .select({ total: count() })
    .from(students)
    .where(narrowing(orgId, asked))
  const total = rows[0]?.total ?? 0
  return {
    totalNote: `총 ${total.toLocaleString('ko-KR')}명`,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
  }
}

export interface RosterScope {
  path: string
  note: string
  rosterUpdatedAt: string
  rosterUpdatedBy: string
  duesUpdatedAt: string
  duesUpdatedBy: string
}

/** 언제 누가 갈아 끼웠나. 명단과 납부가 따로 온다 — 바뀌는 때가 다르다. */
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

/**
 * 이 명단이 다루는 범위.
 *
 * **조직 설정이 정한다.** 화면이 지어낼 수 없고, 학생회가 대표하는 학교와 단과대학을
 * 이어 붙인 것이다 — 학생회를 만들 때 고른 그 값이다.
 */
export async function rosterScope(db: Db, orgId: string): Promise<RosterScope> {
  const rows = await db
    .select({
      schoolName: educationSchools.name,
      collegeName: educationColleges.name,
    })
    .from(organizations)
    .leftJoin(educationSchools, eq(educationSchools.id, organizations.repSchoolId))
    // 학교가 같은 단과대만 잇는다 — 이음매마다 울타리를 다시 세운다.
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
    // **아직 안 정했으면 그렇게 말한다.** 빈 글을 주면 화면이 빈 자리를 그린다.
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

/**
 * 조직 관리 영역 셋이 곁들이는 한 줄.
 *
 * **셈한 숫자가 아니라 완성된 문장을 준다.** 그림이 '부서 5개 · 구성원 18명'을 글자
 * 하나로 그렸기 때문이다 — 쪼개서 다시 이으려면 어디를 어떻게 잇는지를 명세가 정해야
 * 하는데 그것은 표현이고, 표현은 그림의 몫이다.
 */
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
    // **역할 셋은 제품이 정한 것이다.** 행렬이 학생회마다 다르지 않으므로 세지 않는다.
    roles: '기본 역할 3종 · 확정된 권한 매트릭스',
  }
}
