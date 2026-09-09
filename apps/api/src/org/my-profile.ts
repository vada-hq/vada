import { and, asc, eq } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import {
  departments,
  educationColleges,
  educationDepartments,
  educationSchools,
  members,
  organizations,
} from '../db/schema.ts'
import { Blocked, NotFound } from '../routes.ts'

// 내 정보(MY-INFO-01).
//
// **온보딩에서 받아 둔 것을 되돌려 준다.** ONB-01이 이름·학번·학교·단과대학·학부·학년을
// 받아 회장 줄에 담는데, 그것을 보여 주는 자리가 어디에도 없었다 — 조직도가 학부와
// 학년만 그렸고 학번은 아무 화면에도 안 나왔다. 배포된 것을 쓰던 사람이 물었다
// (2026-09-09).
//
// ## 무엇이 이 사람의 것이고 무엇이 아닌가
//
// | | 어디의 것인가 | 고칠 수 있나 |
// | --- | --- | --- |
// | 이름 | 로그인한 계정 | 아니다 |
// | 학번 · 단과대학 · 학부 · 학년 | 이 사람 | 그렇다 |
// | 학교 | 학생회 | 아니다 |
// | 소속 학생회 · 부서 · 직책 | 학생회 | 아니다 |
//
// **학교가 이 사람의 것이 아닌 까닭.** 한 학생회의 구성원은 모두 그 학교 사람이므로
// 사람마다 다르지 않다. 그래서 `members` 표에 학교 칸이 없고(`repSchoolId`가
// `organizations`에 있다), 여기서도 고치는 값이 아니라 보여 주는 값이다.

const GRADE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'education.currentGrades') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

const ROLE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'org.baseRoles') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

export interface MyProfile {
  name: string
  studentNumber: string
  schoolName: string
  college: string
  collegeName: string
  department: string
  departmentName: string
  currentGrade: string
  currentGradeName: string
}

/**
 * 내가 이 학생회에서 무엇인가.
 *
 * **고치는 값이 아니라 읽는 값이다.** 소속 부서와 직책은 조직도가 정하므로
 * `MyProfile`과 갈라 둔다 — 섞으면 '되돌아갈 값'과 '보여 줄 값'의 구분이 사라진다.
 */
export interface MyBelonging {
  orgName: string
  orgDepartment: string
  executiveTitle: string
}

/** 이 학생회가 대표하는 학교. 구성원의 편제는 전부 이 학교 아래에서 고른다. */
async function schoolOf(db: Db, orgId: string): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: educationSchools.id, name: educationSchools.name })
    .from(organizations)
    .innerJoin(educationSchools, eq(organizations.repSchoolId, educationSchools.id))
    .where(eq(organizations.id, orgId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * 고른 단과대·학부의 이름.
 *
 * **없어진 편제도 있다.** 학교가 학과를 없애면 그 사람의 줄에는 코드만 남는데, 그때
 * 지어내지 않고 빈 글을 준다 — 화면은 '고르지 않음'으로 보이고 다시 고를 수 있다.
 */
async function educationNames(
  db: Db,
  collegeId: string | null,
  departmentId: string | null,
): Promise<{ college: string | null; department: string | null }> {
  const college =
    collegeId === null
      ? null
      : ((
          await db
            .select({ name: educationColleges.name })
            .from(educationColleges)
            .where(eq(educationColleges.id, collegeId))
            .limit(1)
        )[0]?.name ?? null)
  const department =
    departmentId === null
      ? null
      : ((
          await db
            .select({ name: educationDepartments.name })
            .from(educationDepartments)
            .where(eq(educationDepartments.id, departmentId))
            .limit(1)
        )[0]?.name ?? null)
  return { college, department }
}

/**
 * 내 학적. **이 화면의 칸을 채우고, 고친 것이 그대로 되돌아간다.**
 *
 * **안 적은 칸은 빈 글이다.** 화면의 칸을 채우는 값이라 '미등록' 같은 말을 넣으면
 * 사람이 그 말을 지우고 자기 것을 적어야 한다 — 조직도에 그리는 말과 다른 자리다.
 *
 * **고르는 값에는 이름표가 딸린다**(`<칸>Name`). 코드만 주면 화면이 여는 순간
 * 'COL-HYU-ERICA-SW'가 칸에 뜬다 — 서버가 완성된 글을 준다는 규칙이 여기도 산다.
 */
export async function myProfile(db: Db, orgId: string, userId: string): Promise<MyProfile> {
  const rows = await db
    .select({
      name: members.name,
      studentNumber: members.studentNumber,
      college: members.college,
      major: members.major,
      grade: members.grade,
    })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (row === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')

  const school = await schoolOf(db, orgId)
  const names = await educationNames(db, row.college, row.major)

  return {
    name: row.name,
    studentNumber: row.studentNumber ?? '',
    // 학교를 못 찾으면 지어내지 않는다. 그 사실이 칸에 그대로 보인다.
    schoolName: school?.name ?? '',
    // **화면의 칸 이름 그대로 준다.** `draftFrom`이 조각 이름과 같은 fieldKey를 찾아
    // 칸을 채우므로, 여기서 이름이 갈리면 그 칸만 조용히 빈 채로 열린다.
    //
    // **고르는 값에는 이름표가 딸린다**(`<칸>Name`). 코드만 주면 화면이 여는 순간
    // 'COL-HYU-ERICA-SW'가 칸에 뜬다 — 서버가 완성된 글을 준다는 규칙이 여기도 산다.
    college: row.college ?? '',
    collegeName: names.college ?? '',
    department: row.major ?? '',
    departmentName: names.department ?? '',
    currentGrade: row.grade ?? '',
    currentGradeName: row.grade === null ? '' : (GRADE_LABEL.get(row.grade) ?? row.grade),
  }
}

/** 소속 학생회와 부서와 직책. */
export async function myBelonging(db: Db, orgId: string, userId: string): Promise<MyBelonging> {
  const rows = await db
    .select({
      role: members.role,
      executiveTitle: members.executiveTitle,
      orgDepartment: departments.name,
      orgName: organizations.name,
    })
    .from(members)
    .innerJoin(organizations, eq(members.orgId, organizations.id))
    .leftJoin(departments, eq(members.departmentId, departments.id))
    .where(and(eq(members.orgId, orgId), eq(members.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (row === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')

  return {
    orgName: row.orgName,
    // **배정 전이라는 사실을 말한다.** 소속 부서는 조직도가 정하는 것이라 이 화면에서
    // 고치지 못하는데, 빈 글로 두면 사람은 자기가 안 적어서 빈 줄 안다.
    orgDepartment: row.orgDepartment ?? '아직 배정되지 않았습니다',
    // 직책이 따로 없으면 역할의 이름이 그 자리를 대신한다(회장단이 아닌 사람).
    executiveTitle: row.executiveTitle ?? ROLE_LABEL.get(row.role) ?? row.role,
  }
}

/** 내 학생회의 학교에 있는 단과대학. */
export async function myColleges(db: Db, orgId: string) {
  const school = await schoolOf(db, orgId)
  if (school === null) return []
  return db
    .select({ value: educationColleges.id, label: educationColleges.name })
    .from(educationColleges)
    .where(eq(educationColleges.schoolId, school.id))
    .orderBy(asc(educationColleges.name))
}

/**
 * 고른 단과대학의 학부·학과.
 *
 * **학교도 함께 건다.** 단과대 id만 걸면 남의 학교에서 온 id가 그 학교의 학과를
 * 끌어온다 — `education.ts`가 같은 규칙을 지킨다.
 */
export async function myDepartments(db: Db, orgId: string, collegeId: string) {
  const school = await schoolOf(db, orgId)
  if (school === null) return []
  return db
    .select({ value: educationDepartments.id, label: educationDepartments.name })
    .from(educationDepartments)
    .where(
      and(
        eq(educationDepartments.schoolId, school.id),
        eq(educationDepartments.collegeId, collegeId),
      ),
    )
    .orderBy(asc(educationDepartments.name))
}

/** 글 칸 하나. **빈 글은 지운 것이다** — 적었던 것을 비우는 길이 있어야 한다. */
function word(draft: Record<string, unknown>, key: string, label: string): string | null {
  const value = draft[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Blocked(`${label} 칸은 글로 적어 주세요`)
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * 내 학적을 고친다.
 *
 * **남의 것은 못 고친다.** 누구의 것인지는 쿠키가 말한다 — 몸통이 사람을 실어 오면
 * 남의 학적을 고칠 수 있는 자리가 된다.
 *
 * **이 학생회의 편제여야 한다.** 고른 단과대·학부가 이 학생회의 학교 아래 있는지
 * 걸어 본다. 안 걸면 아무 코드나 적어 넣을 수 있고, 조직도는 있지도 않은 학부를 그린다.
 *
 * **이름과 학교는 받지 않는다.** 이름은 로그인한 계정의 것이고 학교는 학생회의
 * 것이다 — 받아 놓고 버리면 화면은 보냈다고 믿고 서버는 안 쓴다.
 */
export async function saveMyProfile(
  db: Db,
  orgId: string,
  userId: string,
  draft: Record<string, unknown>,
): Promise<void> {
  const studentNumber = word(draft, 'studentNumber', '학번')
  if (studentNumber === null) throw new Blocked('학번을 적어 주세요')

  const college = word(draft, 'college', '단과대학')
  const major = word(draft, 'department', '학부·학과')
  const grade = word(draft, 'currentGrade', '현재 학년')

  const school = await schoolOf(db, orgId)
  if (school === null) throw new Blocked('학생회의 대표 학교를 찾지 못했습니다')

  if (college !== null) {
    const found = await db
      .select({ id: educationColleges.id })
      .from(educationColleges)
      .where(and(eq(educationColleges.id, college), eq(educationColleges.schoolId, school.id)))
      .limit(1)
    if (found.length === 0) throw new Blocked('그 학교의 그 단과대학을 찾지 못했습니다')
  }

  if (major !== null) {
    // **단과대까지 함께 건다.** 학부만 걸면 다른 단과대의 학부가 붙는다.
    if (college === null) throw new Blocked('단과대학을 먼저 골라 주세요')
    const found = await db
      .select({ id: educationDepartments.id })
      .from(educationDepartments)
      .where(
        and(
          eq(educationDepartments.id, major),
          eq(educationDepartments.schoolId, school.id),
          eq(educationDepartments.collegeId, college),
        ),
      )
      .limit(1)
    if (found.length === 0) throw new Blocked('그 단과대학의 그 학부·학과를 찾지 못했습니다')
  }

  if (grade !== null && !GRADE_LABEL.has(grade)) throw new Blocked('그런 학년은 없습니다')

  const done = await db
    .update(members)
    .set({ studentNumber, college, major, grade })
    .where(and(eq(members.orgId, orgId), eq(members.userId, userId)))
    .returning({ id: members.id })

  if (done.length === 0) throw new NotFound('이 학생회의 구성원이 아닙니다')
}
