import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, members } from '../db/schema.ts'
import { AlreadyExists, Blocked, NotFound } from '../routes.ts'
import { stillHere } from './membership.ts'
import { recordRoleChange } from './role-change.ts'

// 구성원을 학생회에서 내보낸다(ORG-03B → ORG-03D).
//
// **사람이 정했다(2026-09-06): 내보내면 학생회에서 나간다.** 되돌릴 수 없으니
// 확인을 받고 회장단만 한다.
//
// **조직도 저장과 다른 길이다.** 저장은 자리를 옮기는 것이고 덮어쓴다. 이것은
// 사람을 내보내는 것이고 되돌릴 수 없다 — 오랫동안 화면이 조직도 초안에서 줄을
// 빼는 것으로 이 일을 하려 했고, 서버는 그 저장을 받을 수 없어 422를 냈다.

export interface RemovalTarget {
  question: string
  name: string
}

/** 확인 화면이 묻는 말(ORG-03D). **누구인지는 자리가 말한다.** */
export async function memberToRemove(
  db: Db,
  orgId: string,
  memberId: string,
): Promise<RemovalTarget | null> {
  const rows = await db
    .select({ name: members.name, department: departments.name })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    // 이미 나간 사람에게는 물을 것이 없다. 두 회장이 같은 화면을 열어 둔 자리다.
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId), stillHere))
    .limit(1)

  const row = rows[0]
  if (row === undefined) return null
  // **묻는 말까지 서버가 만든다.** 화면이 이름을 문장에 끼워 넣으면 화면마다 다른
  // 말이 나온다 — 이 저장소가 세는 말과 딱지에서 이미 정한 규칙이다.
  return { question: `${row.name} 님을 내보낼까요?`, name: row.name }
}

export interface Removal {
  memberId: string
  actorMemberId: string
  actorUserId: string | null
  now: () => Date
}

export async function removeMember(db: Db, orgId: string, removal: Removal): Promise<void> {
  const rows = await db
    .select({ id: members.id, name: members.name, role: members.role, leftAt: members.leftAt })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.id, removal.memberId)))
    .limit(1)

  const row = rows[0]
  if (row === undefined) throw new NotFound('그 구성원을 찾지 못했습니다')
  // **이미 나갔으면 409다**(계약의 `repeat: conflict`). 조용히 성공으로 답하면
  // '남이 먼저 내보냈다'와 '내가 두 번 눌렀다'가 같은 모양이 된다.
  if (row.leftAt !== null) throw new AlreadyExists('이미 나간 구성원입니다')

  // **자기 자신은 못 내보낸다.** 조직 구조를 고치는 것은 회장단뿐이라 스스로 나가면
  // 다음 순간 아무도 이 화면을 못 여는 학생회가 될 수 있다. 조직도 저장이 같은
  // 까닭으로 같은 것을 막는다 — 두 길이 같은 규칙을 든다.
  if (removal.memberId === removal.actorMemberId) {
    throw new Blocked('자기 자신을 내보낼 수 없습니다')
  }

  // **회장이 없는 학생회가 생기지 않게 한다.** 마지막 회장을 내보내면 조직 구조를
  // 고칠 사람이 아무도 남지 않는다.
  if (row.role === 'chair') {
    const chairs = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.orgId, orgId), stillHere, eq(members.role, 'chair')))
    if (chairs.length <= 1) throw new Blocked('마지막 회장은 내보낼 수 없습니다')
  }

  const at = removal.now()
  await db
    .update(members)
    .set({
      leftAt: at,
      // **자리를 비운다.** 자리를 그대로 두면 다시 들인 사람이 옛 부서에 그대로
      // 앉아 있고, 그 사이 그 부서가 없어졌으면 가리킬 데 없는 자리가 된다.
      departmentId: null,
      isDepartmentLeader: false,
      executiveTitle: null,
    })
    .where(and(eq(members.orgId, orgId), eq(members.id, removal.memberId)))

  // **법이 이 자리를 3년 본다.** 권한을 없앤 기록이고, 역할을 바꾼 것과 같은 표에
  // 같은 모양으로 남는다 — 한쪽만 남기면 남지 않은 쪽이 조용하다.
  await recordRoleChange(db, orgId, {
    memberId: removal.memberId,
    change: '학생회에서 내보냄',
    name: row.name,
    before: row.role,
    after: '나감',
    actorUserId: removal.actorUserId,
    at,
  })
}
