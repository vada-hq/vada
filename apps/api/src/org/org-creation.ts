import type { Db } from '../db/client.ts'
import { departments, members, organizations } from '../db/schema.ts'
import { Blocked } from '../errors.ts'
import { collegeIn } from './education.ts'
import { firstInvite } from './invite.ts'
import { founderName } from './joining-account.ts'
import {
  OPERATING_YEARS,
  ORG_TYPES,
  SETUP_MODES,
  readChoice,
  readMaybe,
  readWord,
} from './joining-input.ts'

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
