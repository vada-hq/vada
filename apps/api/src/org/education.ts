import { and, asc, eq, ilike } from 'drizzle-orm'
import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { educationColleges, educationDepartments, educationSchools } from '../db/schema.ts'

// 학교의 편제를 고르는 세 자리(ONB-01 · ORG-01 · INV-01).
//
// **여기 '학부·학과'는 학생회의 부서가 아니다.** 카탈로그가 `education.departments`와
// `org.departments`를 갈라 부르며 "다른 물건이다"라고 적어 두었고, 표 이름도 그 갈림을
// 그대로 든다(`education_departments` 대 `departments`). 이름이 겹치면 언젠가 남의
// 부서가 학과 목록에 나온다.
//
// **셋이 서로에게 걸려 있다.** 단과대는 학교에, 학부·학과는 그 학교의 그 단과대에.
// 그래서 아래 조회는 **받은 인자를 전부 건다** — 단과대 id만 걸면 남의 학교에서 온
// id가 그 학교의 학과를 끌어온다. 표도 복합 외래 키로 같은 것을 막지만 조회도 스스로
// 건다(벽은 두 겹이 낫다).
//
// ## 아직 열리지 않는다 — 명세가 이 자리를 `member`로 적었다
//
// 이 셋을 부르는 화면(ONB-01 · ORG-01 · INV-01)의 `viewer`는 `joining`이다. 아직 어느
// 학생회의 구성원도 아닌 사람이 학교를 고르는 자리다. 그런데 `option-sources.json`이
// 세 출처의 `authorize.area`를 `member`로 적어 두었고, 계약이 그것을 그대로 나른다 —
// 권한 미들웨어는 구성원이 아닌 사람에게 403을 낸다.
//
// **여기서 뚫지 않는다.** 자리마다 판단을 손으로 뒤집기 시작하면 그 판단이 코드에
// 흩어지고, 흩어진 판단은 아무도 못 본다. 고칠 자리는 `option-sources.json`의
// `authorize.area`(→ `signedIn`)이고 그것은 `specs/` 안이라 이 일의 밖이다. 숨기지 않고
// 적어 둔다.

export interface Option {
  value: string
  label: string
}

/**
 * 검색어가 몇 자부터인가. **명세가 갖고 있다**(`education.schools`의 `search.minLength`).
 *
 * 여기 2를 적으면 명세가 3으로 바뀔 때 두 벌이 갈리고, 갈리면 화면은 '2자 이상
 * 입력하세요'라 말하면서 서버는 아무것도 안 준다.
 */
function searchMinLength(key: string): number {
  const sources = optionSources.sources as Array<{
    key: string
    request?: { search?: { minLength?: number } }
  }>
  const found = sources.find((one) => one.key === key)?.request?.search?.minLength
  if (found === undefined) {
    throw new Error(`선택지 '${key}'의 검색 최소 길이가 명세에 없습니다.`)
  }
  return found
}

const SCHOOL_MIN_QUERY = searchMinLength('education.schools')

/**
 * 학교를 이름으로 찾는다.
 *
 * **너무 짧은 검색어는 찾지 않는다.** 명세가 `minLength`를 적었고 화면은 그 전까지
 * '학교명을 2자 이상 입력하세요'를 그린다. 그때 전국 목록을 통째로 답하면 화면이
 * 그리는 말과 서버가 하는 일이 어긋난다.
 *
 * **빈 목록이 '없다'는 뜻이다.** 계약이 이 자리에 404를 두지 않았고, 명세가 화면에
 * 그릴 말('검색 결과가 없습니다')을 이미 갖고 있다.
 */
export async function schoolOptions(db: Db, query: string): Promise<Option[]> {
  const wanted = query.trim()
  if (wanted.length < SCHOOL_MIN_QUERY) return []
  const rows = await db
    .select({ id: educationSchools.id, name: educationSchools.name })
    .from(educationSchools)
    .where(ilike(educationSchools.name, `%${wanted}%`))
    .orderBy(asc(educationSchools.name))
  return rows.map((row) => ({ value: row.id, label: row.name }))
}

/** 그 학교의 단과대학. 학교를 고르지 않았으면 고를 것도 없다. */
export async function collegeOptions(db: Db, schoolId: string): Promise<Option[]> {
  if (schoolId.trim() === '') return []
  const rows = await db
    .select({ id: educationColleges.id, name: educationColleges.name })
    .from(educationColleges)
    .where(eq(educationColleges.schoolId, schoolId))
    .orderBy(asc(educationColleges.name))
  return rows.map((row) => ({ value: row.id, label: row.name }))
}

/**
 * 그 학교의 그 단과대학의 학부·학과.
 *
 * **학교도 함께 건다.** 단과대 id만 걸면 남의 학교에서 온 id가 그대로 통하고, 그러면
 * 이 목록은 '고른 학교의 학과'가 아니라 '그 id를 아는 사람이 볼 수 있는 학과'가 된다.
 */
export async function departmentOptions(
  db: Db,
  schoolId: string,
  collegeId: string,
): Promise<Option[]> {
  if (schoolId.trim() === '' || collegeId.trim() === '') return []
  const rows = await db
    .select({ id: educationDepartments.id, name: educationDepartments.name })
    .from(educationDepartments)
    .where(
      and(
        eq(educationDepartments.schoolId, schoolId),
        eq(educationDepartments.collegeId, collegeId),
      ),
    )
    .orderBy(asc(educationDepartments.name))
  return rows.map((row) => ({ value: row.id, label: row.name }))
}

/**
 * 그 학교의 그 단과대학. 없으면 null.
 *
 * 이름까지 함께 돌려주는 까닭: 부르는 쪽이 곧바로 **완성된 글**을 만든다
 * ('한양대학교 ERICA · 소프트웨어융합대학'). 있는지만 답하고 이름을 다시 물으면
 * 같은 표를 두 번 연다.
 */
export async function collegeIn(
  db: Db,
  schoolId: string,
  collegeId: string,
): Promise<{ schoolName: string; collegeName: string } | null> {
  const rows = await db
    .select({ schoolName: educationSchools.name, collegeName: educationColleges.name })
    .from(educationColleges)
    .innerJoin(educationSchools, eq(educationSchools.id, educationColleges.schoolId))
    .where(and(eq(educationColleges.schoolId, schoolId), eq(educationColleges.id, collegeId)))
    .limit(1)
  return rows[0] ?? null
}

/** 그 학교의 그 단과대학에 그 학부·학과가 있는가. 셋을 함께 건다. */
export async function departmentIn(
  db: Db,
  schoolId: string,
  collegeId: string,
  departmentId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: educationDepartments.id })
    .from(educationDepartments)
    .where(
      and(
        eq(educationDepartments.schoolId, schoolId),
        eq(educationDepartments.collegeId, collegeId),
        eq(educationDepartments.id, departmentId),
      ),
    )
    .limit(1)
  return rows.length > 0
}
