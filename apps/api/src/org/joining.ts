import { and, eq } from 'drizzle-orm'
import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import {
  departments,
  educationColleges,
  educationSchools,
  invites,
  members,
  organizations,
  users,
} from '../db/schema.ts'
import { Blocked, NotFound } from '../errors.ts'
import { collegeIn, departmentIn } from './education.ts'
import { firstInvite } from './invite.ts'
import { stillHere } from './membership.ts'
import { recordRoleChange } from './role-change.ts'

// 들어오는 길(ONB-01 → ONB-02 → ORG-01 · ORG-02 또는 INV-00 · INV-01).
//
// 구글로 들어온 사람이 **학생회를 만들거나 초대 코드로 들어간다.** 이 파일이 지키는
// 것이 넷이다.
//
// 1. **만든 사람이 그 학생회의 첫 구성원이 된다.** 아니면 만들자마자 자기 학생회를
//    못 본다 — `viewerLookup`이 `members`에서 소속을 찾고, 없으면 셸의 모든 자리가
//    '구성원이 아닙니다'로 닫힌다.
// 2. **읽지 못한 값을 조용히 대신하지 않는다.** 명세에 없는 유형·연도, 있지도 않은
//    학교와 단과대 — 전부 422로 되돌린다. 받아 두고 무시하면 사람은 저장됐다고 믿고
//    화면은 다른 것을 그린다.
// 3. **초대 코드는 학생회에 들어오는 열쇠다.** 계약이 그 인자에 `x-secret`을 달아
//    두었고(감사 기록이 그것을 지운다), 이 파일은 **없는 코드와 꺼진 코드를 가르지
//    않는다** — 가르면 그 답이 '이 코드는 있다'를 알려 주는 자리가 된다.
// 4. **울타리를 이음매마다.** 학교와 단과대와 학부를 함께 걸고, 이미 그 학생회의
//    구성원인지도 그 학생회 안에서만 본다.

/** 명세가 든 선택지. **여기 목록을 다시 적지 않는다** — 두 벌은 갈린다. */
function choicesOf(key: string): Array<{ value: string; label: string }> {
  const sources = optionSources.sources as Array<{
    key: string
    options?: Array<{ value: string; label: string }>
  }>
  const found = sources.find((one) => one.key === key)
  if (found?.options === undefined) {
    throw new Error(`선택지 '${key}'가 명세에 없습니다.`)
  }
  return found.options.map((option) => ({ value: option.value, label: option.label }))
}

export const ORG_TYPES = choicesOf('org.types')
export const OPERATING_YEARS = choicesOf('org.operatingYears')
export const SETUP_MODES = choicesOf('org.setupModes')
export const CURRENT_GRADES = choicesOf('education.currentGrades')

/** 값에서 그려지는 말로. 못 찾으면 null — 지어내지 않는다. */
function labelOf(choices: Array<{ value: string; label: string }>, value: string | null) {
  if (value === null) return null
  return choices.find((choice) => choice.value === value)?.label ?? null
}

/**
 * 받침이 있는가. **조사를 고르는 데 쓴다.**
 *
 * '학생회명을(를) 적어 주세요'는 완성된 글이 아니다 — 서버가 완성해서 주기로 한
 * 이상 조사도 서버가 고른다. 한글 음절이 아닌 끝(영문·숫자)은 알 수 없으므로 덜
 * 어색한 쪽으로 기운다.
 */
function hasFinalConsonant(word: string): boolean {
  const last = (word.at(-1) ?? '').codePointAt(0) ?? 0
  if (last < 0xac00 || last > 0xd7a3) return false
  return (last - 0xac00) % 28 !== 0
}

/** 글 칸 하나. **빈 글은 없는 것으로 본다** — 화면의 빈 칸이 `''`로 온다. */
function readWord(draft: Record<string, unknown>, key: string, label: string): string {
  const value = draft[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Blocked(`${label}${hasFinalConsonant(label) ? '을' : '를'} 적어 주세요`)
  }
  return value.trim()
}

/** 있으면 그 글, 없으면 없는 것. **비워 둘 수 있는 칸에 쓴다** — 지어내서 채우지 않는다. */
function readMaybe(draft: Record<string, unknown>, key: string): string | null {
  const value = draft[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** 명세가 든 선택지가 아니면 막는다. `event.saveBasics`가 참가비 유형에 쓰는 것과 같다. */
function readChoice(
  draft: Record<string, unknown>,
  key: string,
  choices: Array<{ value: string }>,
  label: string,
): string {
  const value = draft[key]
  if (typeof value !== 'string' || !choices.some((choice) => choice.value === value)) {
    throw new Blocked(`그런 ${label}${hasFinalConsonant(label) ? '은' : '는'} 없습니다`)
  }
  return value
}

/**
 * ORG-02가 만든 부서 카드들.
 *
 * **계약이 칸 이름을 모른다.** 상태 스코프에서 뽑힌 이 자리는 `array of object`까지만
 * 적혀 있다(카탈로그의 `list`는 항목의 속을 말하지 않는다). 그림에서 부서 카드가 가진
 * 사실은 **이름 하나**뿐이므로(할 수 있는 일이 이름 고치기와 지우기다) `name`으로
 * 읽는다. 다른 꼴을 함께 받아 주지 않는 까닭: 두 꼴을 받으면 어느 쪽이 계약인지
 * 아무도 모르게 되고, 422 한 줄이 그 사실을 훨씬 빨리 알려 준다.
 *
 * **열까지다.** ORG-02가 `maxItems: 10`으로 그렸다 — 화면만 막는 것은 막는 것이 아니다.
 */
function readDepartments(draft: Record<string, unknown>): string[] {
  const value = draft.departments
  // 없으면 없는 것이다. '빈 조직'으로 시작하는 길이 명세에 있다(setupMode: empty).
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Blocked('부서는 목록으로 보내 주세요')
  if (value.length > 10) throw new Blocked('부서는 열 개까지 만들 수 있습니다')

  const names: string[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Blocked('부서는 { name } 꼴로 보내 주세요')
    }
    const name = (item as { name?: unknown }).name
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Blocked('부서 이름을 적어 주세요')
    }
    const trimmed = name.trim()
    // **같은 이름을 둘 두지 않는다.** 표가 `(orgId, name)`을 유일하게 지키므로 그냥
    // 넣으면 500이 되고, 조용히 하나로 합치면 사람은 둘을 만들었다고 믿는다.
    if (names.includes(trimmed)) throw new Blocked(`부서 이름이 겹칩니다: ${trimmed}`)
    names.push(trimmed)
  }
  return names
}

export interface OrgIds {
  newId: () => string
  now: () => Date
  /** 첫 초대의 코드. 추측할 수 없어야 한다 — 학생회에 들어오는 열쇠다. */
  newCode: () => string
}

/**
 * 학생회를 만든다(ORG-01 · ORG-02).
 *
 * **만든 사람이 회장이 된다.** 계약이 돌려주는 값을 두지 않았으므로 화면은 곧바로
 * 홈으로 가는데(ORG-02의 `onSuccess`), 그 홈은 '내가 어느 학생회의 누구인가'로
 * 그려진다 — 구성원 줄이 없으면 방금 만든 학생회가 보이지 않는다.
 *
 * **학적 정보도 함께 온다**(2026-09-08). 만드는 사람도 학생회의 일원이므로 그 사람의
 * 학번·학부·학년이 회장 줄에 담겨야 한다 — 한동안 ONB-01이 받아 놓고 아무 데도 담지
 * 않아, 조직도에서 만든 사람만 '학부 미등록'으로 섰다. 흐름 하나에 초안이 둘인데
 * 보내기는 하나라, 화면이 앞 초안(`onboardingDraft`)을 합쳐 보낸다.
 *
 * **이름은 서버가 아는 것을 쓴다.** 초안의 이름을 그대로 믿으면 남의 이름으로 만들 수
 * 있다 — 초대로 들어오는 길(`joinOrg`)과 같은 규칙이다. 안 온 칸은 비워 둔다:
 * 조직도가 그 자리에 '학부 미등록'을 그린다. 지어내서 채우지 않는다.
 *
 * **초대는 여기서 만들지 않는다.** 명세에 '초대를 처음 만드는' 자리가 없고,
 * `org.regenerateInvite`가 없을 때 처음 만드는 일까지 한다(참석 QR과 같은 길이다).
 */
export async function createOrg(
  db: Db,
  userId: string,
  draft: Record<string, unknown>,
  make: OrgIds,
): Promise<{ orgId: string }> {
  const orgType = readChoice(draft, 'orgType', ORG_TYPES, '학생회 유형')
  const operatingYear = readChoice(draft, 'operatingYear', OPERATING_YEARS, '운영 연도')
  // **받아서 확인만 하고 저장하지 않는다.** 이 값이 정하는 것은 부서 목록의 첫 모습이고
  // (ORG-02의 `initialItems`), 그 목록은 사람이 고친 뒤 아래 `departments`로 온다.
  // 여기서 다시 유추하면 사람이 지운 부서가 되살아난다.
  readChoice(draft, 'setupMode', SETUP_MODES, '조직 구조 생성 방식')
  const orgName = readWord(draft, 'orgName', '학생회명')
  const repSchool = readWord(draft, 'repSchool', '대표 학교')
  const repCollege = readWord(draft, 'repCollege', '대표 단과대학')
  const departmentNames = readDepartments(draft)

  // **그 학교의 그 단과대여야 한다.** 따로 확인하면 한양대 아래에 옆 학교의 단과대가
  // 붙고, 초대장이 있지도 않은 범위를 대표한다고 말한다.
  if ((await collegeIn(db, repSchool, repCollege)) === null) {
    throw new Blocked('그 학교의 그 단과대학을 찾지 못했습니다')
  }

  const founder = await founderName(db, userId)

  const orgId = make.newId()
  const at = make.now()
  await db.insert(organizations).values({
    id: orgId,
    name: orgName,
    // 딱지가 아니라 값을 담는다 — 표 머리가 그 까닭을 적었다.
    kind: orgType,
    term: operatingYear,
    repSchoolId: repSchool,
    repCollegeId: repCollege,
    createdAt: at,
  })

  if (departmentNames.length > 0) {
    await db.insert(departments).values(
      departmentNames.map((name, order) => ({
        id: make.newId(),
        orgId,
        name,
        // **사람이 늘어놓은 차례를 지킨다.** 조직도가 이름순이 아니라 이 값으로 그린다.
        sortOrder: order,
      })),
    )
  }

  await db.insert(members).values({
    id: make.newId(),
    orgId,
    userId,
    name: founder,
    // 앞 화면이 받은 학적. 안 온 칸은 비워 둔다 — 지어내지 않는다.
    studentNumber: readMaybe(draft, 'studentNumber'),
    college: readMaybe(draft, 'college'),
    major: readMaybe(draft, 'department'),
    grade: readMaybe(draft, 'currentGrade'),
    role: 'chair',
    // **회장이다.** 사람이 그렇게 정했다 — 만든 사람이 그 학생회의 첫 구성원(회장)이다.
    // 조직도가 이 말로 차례와 색을 정한다(`chart.ts`).
    executiveTitle: '회장',
    createdAt: at,
  })

  // **초대를 함께 만든다.** 없으면 아무도 이 학생회에 못 들어오고, 조직도 화면이
  // 초대를 읽다 죽는다 — 다시 만드는 단추가 그 죽은 화면 안에 있어 빠져나올 길도 없다.
  await firstInvite(db, orgId, make)

  // 계약이 '돌려주는 값이 없다'고 적었으므로 이 값은 **밖으로 나가지 않는다** —
  // 부르는 쪽이 기록에 '어느 학생회를 만들었나'를 적는 데만 쓴다.
  return { orgId }
}

/**
 * 회장 줄에 적을 이름.
 *
 * **모르면 만들지 않는다.** 소셜 로그인이 이름을 주지 않은 계정이 있을 수 있고,
 * 그때 이메일이나 빈 글을 넣으면 조직도에 그것이 사람 이름으로 그려진다.
 */
async function founderName(db: Db, userId: string): Promise<string> {
  const rows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const name = rows[0]?.name?.trim() ?? ''
  if (name === '') {
    throw new Blocked('계정에 이름이 없어 회장으로 등록할 수 없습니다')
  }
  return name
}

/**
 * 코드가 가리키는 학생회. 없거나 꺼졌으면 null.
 *
 * **둘을 가르지 않는다.** '없는 코드'와 '꺼진 코드'를 다르게 답하면 그것으로 어떤
 * 코드가 있었는지를 알아낼 수 있다.
 */
async function orgOfCode(db: Db, code: string): Promise<string | null> {
  const rows = await db
    .select({ orgId: invites.orgId })
    .from(invites)
    .where(and(eq(invites.code, code), eq(invites.active, true)))
    .limit(1)
  return rows[0]?.orgId ?? null
}

/**
 * 초대 코드가 쓸 수 있는 것인지 서버에 묻는다(INV-00).
 *
 * **묻기만 하고 아무것도 바꾸지 않는다**(mutations.json의 `repeat: overwrite`). 실제로
 * 들어가는 것은 다음 화면의 마지막 단추이고 그 자리가 `joinOrg`다 — 2026-09-06까지
 * 그 자리가 없어서, 코드를 확인하고 소속을 적고 눌러도 아무도 구성원이 되지 않았다.
 *
 * **'이미 다른 학생회에 속해 있는지'를 이 학생회 안에서 본다.** 명세의 그 문장을
 * '어느 학생회에든 속해 있으면 안 된다'로 읽으면 다른 자리와 어긋난다 — 한 사람이
 * 여러 학생회에 속할 수 있고(`auth/viewer.ts`), 학생회를 여럿 만들 수도 있다
 * (`org.create`의 `repeat.why`). 두 번 들어갈 수 없는 것은 **같은 학생회**다.
 *
 * 학적 칸까지 보는 까닭: 계약이 일곱을 전부 필수로 적었다. 받아 두고 안 보면 그
 * 필수는 말뿐이고, 화면은 확인됐다고 믿은 채 다음 화면으로 간다.
 */
export async function verifyInviteCode(
  db: Db,
  userId: string,
  draft: Record<string, unknown>,
): Promise<{ orgId: string }> {
  const code = readWord(draft, 'inviteCode', '초대 코드')
  const school = readWord(draft, 'school', '학교')
  const college = readWord(draft, 'college', '단과대학')
  const department = readWord(draft, 'department', '학부·학과')
  readChoice(draft, 'currentGrade', CURRENT_GRADES, '학년')
  readWord(draft, 'studentNumber', '학번')
  readWord(draft, 'name', '이름')

  // 셋을 함께 건다 — 남의 학교에서 온 단과대 id로 학과가 통하면 안 된다.
  if (!(await departmentIn(db, school, college, department))) {
    throw new Blocked('그 학교의 그 학부·학과를 찾지 못했습니다')
  }

  const orgId = await orgOfCode(db, code)
  if (orgId === null) throw new Blocked('쓸 수 없는 초대 코드입니다')

  const already = await db
    .select({ id: members.id })
    .from(members)
    // 내보낸 사람은 구성원이 아니다. 안 걸면 나갔던 사람이 다시 초대를 받고도
    // '이미 구성원입니다'에 막혀 영영 못 들어온다.
    .where(and(eq(members.orgId, orgId), eq(members.userId, userId), stillHere))
    .limit(1)
  if (already.length > 0) throw new Blocked('이미 이 학생회의 구성원입니다')

  return { orgId }
}

/**
 * 확인한 학생회에 **실제로 들어간다**(INV-01의 마지막 단추).
 *
 * **확인과 같은 벽을 다시 세운다.** 확인은 묻기만 하므로 그 사이에 코드가 죽거나
 * 소속이 바뀔 수 있고, 확인을 건너뛰고 여기로 곧장 보낼 수도 있다. 그래서 판정은
 * `verifyInviteCode`가 한 벌만 들고 여기가 그것을 다시 부른다 — 두 벌을 두면 갈린다.
 *
 * **나갔던 사람은 그 줄로 돌아온다.** 새 줄을 만들면 그 사람이 예전에 쓴 문서와 올린
 * 요청이 다른 사람의 것처럼 갈린다. 한 사람에게는 이 학생회의 줄이 하나다.
 *
 * **역할은 부원이고 부서는 없다.** 초대로 들어오는 사람에게 회장단을 줄 근거가
 * 아무 데도 없고, 어느 부서인지는 조직도(ORG-03B)가 정한다.
 */
export async function joinOrg(
  db: Db,
  userId: string,
  draft: Record<string, unknown>,
  // 초대 코드는 만들지 않는다 — 이미 있는 초대로 들어오는 자리다.
  make: Pick<OrgIds, 'newId' | 'now'>,
): Promise<{ orgId: string }> {
  const { orgId } = await verifyInviteCode(db, userId, draft)
  const at = make.now()

  // 나갔던 줄이 있으면 그것을 되살린다. 없으면 새로 만든다.
  const left = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.userId, userId)))
    .limit(1)

  const name = await founderName(db, userId)
  const student = {
    name,
    studentNumber: readWord(draft, 'studentNumber', '학번'),
    college: readWord(draft, 'college', '단과대학'),
    major: readWord(draft, 'department', '학부·학과'),
    grade: readChoice(draft, 'currentGrade', CURRENT_GRADES, '학년'),
  }

  const memberId = left[0]?.id ?? make.newId()
  if (left[0] === undefined) {
    await db.insert(members).values({ id: memberId, orgId, userId, role: 'member', createdAt: at, ...student })
  } else {
    // 다시 들어오는 사람이다. 자리는 비운 채로 두고(조직도가 정한다) 학적만 새로 받는다.
    await db.update(members).set({ leftAt: null, ...student }).where(eq(members.id, memberId))
  }

  // **법이 이 자리를 3년 본다.** 권한을 준 기록이고, 내보낸 기록과 같은 표에 같은
  // 모양으로 남는다 — 한쪽만 남기면 '언제 들어왔는지 모르는 사람이 나갔다'가 된다.
  await recordRoleChange(db, orgId, {
    memberId,
    change: '학생회에 참여',
    name,
    before: left[0] === undefined ? null : '나감',
    after: 'member',
    actorUserId: userId,
    at,
  })

  return { orgId }
}

export interface InvitedOrganization {
  name: string
  kind: string
  scope: string
  term: string
}

/**
 * 초대 코드가 찾아낸 학생회(INV-01).
 *
 * **넷 다 완성된 글이다.** 표에는 값이 들어 있고('college'·'2026'·가리킨 두 줄) 사람에게
 * 보일 말은 여기서 만든다 — 화면이 이어 붙이면 딱지의 규칙이 화면에 박힌다.
 *
 * **비어 있으면 없다고 말한다.** 빈 글을 주면 화면은 그 자리에 아무것도 없는 카드를
 * 그리고, 사람은 '유형' 옆이 왜 비었는지 알 수 없다. 조직도가 '학부 미등록'을 쓰는 것과
 * 같은 길이다.
 */
export async function invitedOrganization(
  db: Db,
  code: string,
): Promise<{ orgId: string; card: InvitedOrganization }> {
  const rows = await db
    .select({
      orgId: organizations.id,
      name: organizations.name,
      kind: organizations.kind,
      term: organizations.term,
      schoolName: educationSchools.name,
      collegeName: educationColleges.name,
    })
    .from(invites)
    .innerJoin(organizations, eq(organizations.id, invites.orgId))
    .leftJoin(educationSchools, eq(educationSchools.id, organizations.repSchoolId))
    // 학교가 같은 단과대만 잇는다 — 이음매마다 울타리를 다시 세운다.
    .leftJoin(
      educationColleges,
      and(
        eq(educationColleges.id, organizations.repCollegeId),
        eq(educationColleges.schoolId, organizations.repSchoolId),
      ),
    )
    .where(and(eq(invites.code, code), eq(invites.active, true)))
    .limit(1)
  const row = rows[0]
  // 없는 코드와 꺼진 코드를 가르지 않는다. 계약이 이 자리에 404를 두었다.
  if (row === undefined) throw new NotFound('그 초대 코드의 학생회를 찾지 못했습니다')

  return {
    orgId: row.orgId,
    card: {
      name: row.name,
      kind: labelOf(ORG_TYPES, row.kind) ?? '유형 미등록',
      scope:
        row.schoolName === null || row.collegeName === null
          ? '대표 범위 미등록'
          : `${row.schoolName} · ${row.collegeName}`,
      term: labelOf(OPERATING_YEARS, row.term) ?? '운영 연도 미등록',
    },
  }
}
