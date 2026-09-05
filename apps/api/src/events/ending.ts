import { and, eq, sql } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import permissionsJson from '../../../../specs/figma/vada-wireframe/permissions.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { events, tasks } from '../db/schema.ts'
import { NotFound } from '../routes.ts'

// 행사를 끝내는 두 모달(EVT-02C · EVT-02E)이 읽는 것.
//
// **역할 이름이 이 글 안에 들어간다.** 명세가 그것을 서버에 맡긴 까닭을 계약이
// 적어 두었다 — "'행사 운영 조직 관리자 또는 회장단'을 명세가 들면 조직 규칙이
// 바뀔 때마다 명세가 틀린다."
//
// 그래서 **글을 여기 적지 않고 권한 행렬에서 만든다.** 행렬을 고치면 이 글이
// 저절로 따라오고, 두 벌이 갈릴 자리가 없다(ORG-04이 그리는 표도 같은 원본에서 온다).

const ROLES = ['chair', 'head', 'member'] as const

/** 역할 이름은 **명세가 갖고 있다**(org.baseRoles). 두 벌을 들면 갈린다. */
const ROLE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'org.baseRoles') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

interface Rule {
  when: string
  label?: string
}

const AREAS = new Map<string, Record<string, Rule>>(
  (permissionsJson.areas as Array<{ key: string; rules: Record<string, Rule> }>).map((area) => [
    area.key,
    area.rules,
  ]),
)

/**
 * '누가 이것을 할 수 있는가'를 **행렬의 말 그대로** 한 문장으로.
 *
 * 조건이 붙는 자리는 행렬이 붙인 딱지를 괄호에 그대로 든다('행사 조직만'). 조건을
 * 여기서 풀어 쓰면 그 풀이가 두 번째 진실이 되고, 행렬을 고칠 때 함께 안 고쳐진다.
 *
 * 같은 딱지를 든 역할은 묶는다 — '부서장(행사 조직만) 또는 부원(행사 조직만)'은
 * 같은 말을 두 번 하는 것이다.
 */
export function whoCanNote(areaKey: string, what: string): string {
  const rules = AREAS.get(areaKey)
  // **모르는 영역은 지어내지 않는다.** 판정기가 같은 자리에서 같은 답을 한다.
  if (rules === undefined) throw new Error(`권한 영역 '${areaKey}'가 명세에 없습니다.`)

  const grouped: Array<{ label: string; roles: string[] }> = []
  for (const role of ROLES) {
    const rule = rules[role]
    if (rule === undefined || rule.when === 'never') continue
    const label = rule.label ?? ''
    const already = grouped.find((one) => one.label === label)
    const name = ROLE_LABEL.get(role) ?? role
    if (already === undefined) grouped.push({ label, roles: [name] })
    else already.roles.push(name)
  }

  const parts = grouped.map((one) =>
    // '가능'은 조건이 아니라 '그냥 된다'는 뜻이라 괄호를 달지 않는다.
    one.label === '가능' || one.label === '' ? one.roles.join('·') : `${one.roles.join('·')}(${one.label})`,
  )
  return `${what}는 ${parts.join(' 또는 ')}만 할 수 있습니다.`
}

/** 이 학생회의 그 행사인가. **남의 학생회 행사는 여기서도 없는 것이다.** */
async function eventOf(db: Db, orgId: string, eventId: string): Promise<void> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  if (rows.length === 0) throw new NotFound('그 행사를 찾지 못했습니다')
}

export interface EndPermission {
  title: string
  note: string
}

/**
 * 행사를 종료할 권한이 없다는 안내(EVT-02C).
 *
 * **판정하지 않는다.** 이 자리는 구성원이면 열리고(계약의 x-authorize가 member다),
 * 실제로 막는 일은 종료 변이가 한다 — 여기서 하는 것은 그 규칙을 말로 옮기는 것뿐이다.
 */
export async function endPermission(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EndPermission> {
  await eventOf(db, orgId, eventId)
  return {
    title: '이 행사를 종료할 권한이 없습니다',
    // 종료는 '행사 정보 수정·종료 처리'에 든다 — 행렬이 그 둘을 한 줄로 적었다.
    note: whoCanNote('event.manage', '행사 종료'),
  }
}

export interface CompleteConfirm {
  warningNote?: string
  warningTone?: string
  permissionNote: string
}

/**
 * 행사를 완료 처리해도 되는지 살펴 준 것(EVT-02E).
 *
 * **막지 않는다** — 남은 것이 있어도 알려 줄 뿐이다(`meeting.endConfirm`과 같은 자리).
 *
 * **남은 것이 없으면 그 줄이 아예 오지 않는다.** 계약이 optional로 적었고, '미완료
 * 업무 0건'을 주면 화면이 빈 경고 상자를 그린다.
 */
export async function completeConfirm(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<CompleteConfirm> {
  await eventOf(db, orgId, eventId)
  const rows = await db
    .select({ left: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(
        eq(tasks.orgId, orgId),
        eq(tasks.eventId, eventId),
        // 끝난 업무는 '남은 것'이 아니다.
        sql`${tasks.status} <> 'done'`,
      ),
    )
  const left = Number(rows[0]?.left ?? 0)

  const drawn: CompleteConfirm = {
    permissionNote: whoCanNote('event.complete', '행사 완료 처리'),
  }
  if (left > 0) {
    drawn.warningNote = `미완료 업무 ${left}건`
    // 색도 데이터가 든다 — 무엇이 얼마나 급한지는 행사마다 다르다.
    drawn.warningTone = 'orange'
  }
  return drawn
}
