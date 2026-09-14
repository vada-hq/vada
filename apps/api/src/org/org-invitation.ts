import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  educationColleges,
  educationSchools,
  invites,
  members,
  organizations,
} from '../db/schema.ts'
import { Blocked, NotFound } from '../errors.ts'
import { departmentIn } from './education.ts'
import { founderName } from './joining-account.ts'
import {
  CURRENT_GRADES,
  OPERATING_YEARS,
  ORG_TYPES,
  labelOf,
  readChoice,
  readWord,
} from './joining-input.ts'
import type { OrgIds } from './org-creation.ts'
import { stillHere } from './membership.ts'
import { recordRoleChange } from './role-change.ts'

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
