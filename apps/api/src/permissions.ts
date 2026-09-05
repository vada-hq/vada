import permissionsJson from '../../../specs/figma/vada-wireframe/permissions.json' with { type: 'json' }

// 누가 무엇을 할 수 있는가. **한 곳에서만 답한다.**
//
// 화면은 `can*` 조각을 받아 단추를 그릴지 정하고, 서버는 들어온 요청을 막을지
// 정한다. 그 둘이 다른 코드에서 나오면 언젠가 갈리고, 갈리는 쪽은 늘 서버가 아니라
// 화면이다 — 화면이 단추를 그렸는데 눌리면 막히는 것이 그 모습이다. 그래서
// 여기 하나만 두고 양쪽이 이것을 부른다.
//
// **규칙은 여기 없다.** `specs/figma/vada-wireframe/permissions.json`이 갖고 있고
// 여기서는 그 조건 이름마다 '어떻게 판정하는가'만 정한다. 규칙이 바뀌면 명세가
// 바뀌고, 명세가 바뀌면 검사가 잡는다.

export type Role = 'chair' | 'head' | 'member'

/** 지금 묻는 사람. 없으면 로그인하지 않은 것이다. */
export interface Viewer {
  userId: string
  /** 이 학생회의 구성원인가. 아니면 null — 학생회를 만들려는 사람이 그렇다. */
  membership: {
    orgId: string
    memberId: string
    role: Role
    departmentId: string | null
    /**
     * 재정을 맡는 부서에 속해 있는가.
     *
     * **부서 이름으로 보지 않는다** — 학생회마다 이름이 다르고(재무부·회계국)
     * 이름을 바꾸면 권한이 조용히 사라진다. 부서에 단 표시가 정한다.
     */
    inFinanceDepartment: boolean
  } | null
}

/**
 * 대상을 봐야 답할 수 있는 것들. **저장소가 답한다.**
 *
 * '행사 조직만'은 그 행사의 운영 조직에 속했는지를 봐야 하고, 그것은 여기 없는
 * 사실이다. 판정 함수가 저장소를 직접 열면 검사에서 저장소가 필요해지므로 밖에서 준다.
 */
export interface Lookups {
  isEventStaff(memberId: string, eventId: string): Promise<boolean>
  isEventStaffManager(memberId: string, eventId: string): Promise<boolean>
  isMeetingHost(memberId: string, meetingId: string): Promise<boolean>
  isMeetingCreator(memberId: string, meetingId: string): Promise<boolean>
  /** 그 회의의 참가자인가. 만든 사람과 진행 권한자도 참가자다 — 회의록은 참가자가 함께 쓴다. */
  isMeetingParticipant(memberId: string, meetingId: string): Promise<boolean>
}

interface Rule {
  when: string
}
interface Area {
  key: string
  rules: Record<string, Rule>
}

const AREAS = new Map<string, Area>(
  (permissionsJson.areas as Area[]).map((area) => [area.key, area]),
)

/** 조건이 무엇을 알아야 판정할 수 있는가. 명세가 조건마다 적어 둔 것이다. */
const NEEDS = new Map<string, string | undefined>(
  (permissionsJson.conditions as Array<{ key: string; needs?: string }>).map((condition) => [
    condition.key,
    condition.needs,
  ]),
)

export class UnknownArea extends Error {}

/**
 * 이 사람이 이 자리를 열 수 있는가.
 *
 * `object`는 조건이 대상을 요구할 때 그 대상의 id다. 어느 인자가 그것인지는
 * 자리마다 `authorize.object`가 말한다.
 */
export async function can(
  viewer: Viewer | null,
  areaKey: string,
  object: string | null,
  lookups: Lookups,
): Promise<boolean> {
  const area = AREAS.get(areaKey)
  // **모르는 영역은 막는다.** 이름이 틀린 자리를 열어 주면 그 오타가 구멍이 된다.
  if (area === undefined) {
    throw new UnknownArea(`권한 영역 '${areaKey}'가 명세에 없습니다.`)
  }

  // 로그인이 필요 없는 자리는 여기서 끝난다 — 볼 수 있는 범위는 주소가 실어 온
  // 토큰이 정하고, 그것은 권한이 아니라 그 자리의 일이다.
  if (isEveryRoleWhen(area, 'anyone')) return true
  if (viewer === null) return false
  if (isEveryRoleWhen(area, 'signedIn')) return true

  const membership = viewer.membership
  if (membership === null) return false

  const rule = area.rules[membership.role]
  if (rule === undefined) return false
  return evaluate(rule.when, membership, object, lookups)
}

function isEveryRoleWhen(area: Area, when: string): boolean {
  const rules = Object.values(area.rules)
  return rules.length > 0 && rules.every((rule) => rule.when === when)
}

async function evaluate(
  when: string,
  membership: NonNullable<Viewer['membership']>,
  object: string | null,
  lookups: Lookups,
): Promise<boolean> {
  // 대상이 필요한 조건인데 대상이 없으면 **막는다.** 열어 두면 '어느 행사인지
  // 모르지만 되기는 된다'가 되고, 그것은 조건이 없는 것과 같다.
  if (NEEDS.get(when) !== undefined && NEEDS.get(when) !== 'viewer' && object === null) {
    return false
  }

  switch (when) {
    case 'always':
      return true
    case 'never':
      return false
    case 'orgMember':
      return true
    case 'signedIn':
      return true
    case 'anyone':
      return true
    case 'financeDepartment':
      return membership.inFinanceDepartment
    case 'eventStaff':
      return lookups.isEventStaff(membership.memberId, object!)
    case 'eventStaffManager':
      return lookups.isEventStaffManager(membership.memberId, object!)
    case 'meetingHost':
      return lookups.isMeetingHost(membership.memberId, object!)
    case 'meetingCreator':
      return lookups.isMeetingCreator(membership.memberId, object!)
    case 'meetingParticipant':
      return lookups.isMeetingParticipant(membership.memberId, object!)
    // **명세가 아직 말하지 않은 자리는 막는다.** 지어내서 열어 두면 그 자리는
    // 규칙이 없는 채로 열려 있고, 아무도 그 사실을 모른다.
    case 'unstated':
      return false
    default:
      throw new UnknownArea(`조건 '${when}'을 판정할 줄 모릅니다.`)
  }
}
