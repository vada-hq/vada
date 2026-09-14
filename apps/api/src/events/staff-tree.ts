import { and, asc, eq } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { eventStaffDepartments } from '../db/schema.ts'
import { Blocked } from '../errors.ts'
import { departmentTree } from '../org/chart.ts'
import {
  eventOf,
  eventStaffRows,
  staffPerson,
  type StaffPerson,
} from './staff-data.ts'

export interface StaffLeader extends StaffPerson {
  roleLabel: string
  roleTone: string
}

/**
 * 행사 책임자(EVT-01 · EVT-03A · EVT-03B).
 *
 * **자리 이름을 명세가 들지 않는다**(계약이 그렇게 적었다). 표가 이 행사에서 부르는
 * 직함을 들고 있으면 그것이고, 없으면 그림이 그린 말이다. 색은 조직도의 회장과
 * 같은 자리이므로 같은 색을 쓴다 — 나무의 뿌리이고, 그림도 그 딱지를 노랗게 그렸다.
 */
export async function eventStaffLeaders(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<StaffLeader[]> {
  await eventOf(db, orgId, eventId)
  const rows = await eventStaffRows(db, orgId, eventId)
  return rows
    .filter((row) => row.isEventLeader)
    .map((row) => ({
      ...staffPerson({ id: row.memberId, name: row.name, major: row.major, grade: row.grade }),
      roleLabel: row.roleTitle ?? '책임자',
      roleTone: 'yellow',
    }))
}

export interface StaffDepartment {
  id: string
  name: string
  memberCountLabel: string
  leaders: StaffPerson[]
  members: StaffPerson[]
}

/**
 * 행사 운영 부서들(EVT-01 · EVT-03A · EVT-03B).
 *
 * **세는 말도 서버가 만든다.** '부원 2명'은 저장하는 값이 아니라 세어서 말로 만든
 * 것이고, 화면이 세면 세는 규칙이 화면에 박힌다.
 */
export async function eventStaffDepartmentTree(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<StaffDepartment[]> {
  await eventOf(db, orgId, eventId)
  const [groups, people] = await Promise.all([
    db
      .select({ id: eventStaffDepartments.id, name: eventStaffDepartments.name })
      .from(eventStaffDepartments)
      .where(
        and(
          eq(eventStaffDepartments.orgId, orgId),
          eq(eventStaffDepartments.eventId, eventId),
        ),
      )
      // 사람이 정한 차례가 있다. 이름순이 아니다.
      .orderBy(asc(eventStaffDepartments.sortOrder), asc(eventStaffDepartments.name)),
    eventStaffRows(db, orgId, eventId),
  ])

  return groups.map((group) => {
    const mine = people.filter((row) => row.staffDepartmentId === group.id)
    const members = mine
      .filter((row) => !row.isDepartmentLeader)
      .map((row) => staffPerson({ id: row.memberId, name: row.name, major: row.major, grade: row.grade }))
    return {
      id: group.id,
      name: group.name,
      memberCountLabel: `부원 ${members.length}명`,
      leaders: mine
        .filter((row) => row.isDepartmentLeader)
        .map((row) =>
          staffPerson({ id: row.memberId, name: row.name, major: row.major, grade: row.grade }),
        ),
      members,
    }
  })
}

/** 고를 수 있는 방식은 **명세가 갖고 있다**(event.staffSetupModes). 두 벌을 들면 갈린다. */
export const SETUP_MODES: readonly string[] = (
  optionSourcesJson.sources.find((source) => source.key === 'event.staffSetupModes') as
    | { options: Array<{ value: string }> }
    | undefined
)?.options.map((option) => option.value) ?? []

/**
 * 고른 방식으로 만들어질 운영 조직의 미리보기(EVT-01).
 *
 * - `copyBase` — 학생회 기본 조직을 그대로 쓴다. 그래서 **조직도와 같은 답**이다.
 * - `empty` — 처음부터 새로 구성하므로 만들어질 것이 없다.
 * - `pickDepartments` — **아직 고른 것이 없다.** 계약이 이 자리에 넘기는 인자는
 *   방식 하나뿐이고(고른 부서를 실을 자리가 없다) 고르는 칸도 그려지지 않았다.
 *   그러므로 지금 고른 것으로 만들어질 부서는 없다. 부서 전체를 대신 주면 그것은
 *   '고르기 전'과 '전부 골랐다'를 같게 만드는 조용한 대체다.
 *
 * **안 넘긴 것과 틀리게 넘긴 것은 다르다.** 방식은 화면 안의 칸에 살아서 그릇이
 * 미리 받을 때는 아직 없다 — 그때 막으면 화면이 그려지기도 전에 통째로 오류가
 * 된다(업무 보드의 `readScope`가 같은 자리에서 같은 규칙을 쓴다). 아무것도 안
 * 골랐으면 만들어질 것도 없고, 없는 방식을 골랐으면 막는다.
 */
export async function staffSetupPreview(
  db: Db,
  orgId: string,
  eventId: string,
  setupMode: string | undefined,
): Promise<StaffDepartment[]> {
  await eventOf(db, orgId, eventId)
  const mode = (setupMode ?? '').trim()
  if (mode === '') return []
  // **명세에 없는 방식은 막는다.** 조용히 빈 목록을 주면 '빈 조직'과 구별되지 않는다.
  if (!SETUP_MODES.includes(mode)) throw new Blocked('명세에 없는 조직 구성 방식입니다')
  if (mode !== 'copyBase') return []
  // 기본 조직을 그대로 쓴다는 뜻이므로 **조직도가 답하는 것을 그대로** 준다.
  return departmentTree(db, orgId)
}
