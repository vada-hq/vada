import { describe, expect, it } from 'vitest'
import permissionsJson from '../../../specs/figma/vada-wireframe/permissions.json' with { type: 'json' }
import openapi from '../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { can, UnknownArea, type Lookups, type Role, type Viewer } from './permissions.ts'

const NO: Lookups = {
  isEventStaff: async () => false,
  isEventStaffManager: async () => false,
  isMeetingHost: async () => false,
  isMeetingCreator: async () => false,
}
const YES: Lookups = {
  isEventStaff: async () => true,
  isEventStaffManager: async () => true,
  isMeetingHost: async () => true,
  isMeetingCreator: async () => true,
}

function viewer(role: Role, extra: { finance?: boolean } = {}): Viewer {
  return {
    userId: 'U-1',
    membership: {
      orgId: 'O-1',
      memberId: 'M-1',
      role,
      departmentId: 'D-1',
      inFinanceDepartment: extra.finance === true,
    },
  }
}
const 로그인만: Viewer = { userId: 'U-2', membership: null }

describe('누가 무엇을 할 수 있는가', () => {
  it('행렬이 전원 가능이라 한 자리는 부원도 연다', async () => {
    expect(await can(viewer('member'), 'finance.read', null, NO)).toBe(true)
    expect(await can(viewer('member'), 'students.read', null, NO)).toBe(true)
  })

  it('행렬이 회장단만이라 한 자리는 부서장도 막는다', async () => {
    expect(await can(viewer('chair'), 'org.structure', null, NO)).toBe(true)
    expect(await can(viewer('head'), 'org.structure', null, NO)).toBe(false)
    expect(await can(viewer('member'), 'org.structure', null, NO)).toBe(false)
  })

  // 부서 이름이 아니라 부서에 단 표시가 정한다.
  it('재정부만인 자리는 그 표시를 가진 사람에게만 열린다', async () => {
    expect(await can(viewer('head'), 'finance.manage', null, NO)).toBe(false)
    expect(await can(viewer('head', { finance: true }), 'finance.manage', null, NO)).toBe(true)
    // 회장단은 부서와 무관하게 된다.
    expect(await can(viewer('chair'), 'finance.manage', null, NO)).toBe(true)
  })

  it('행사 조직만인 자리는 그 행사의 조직원에게만 열린다', async () => {
    expect(await can(viewer('head'), 'event.manage', 'E-01', NO)).toBe(false)
    expect(await can(viewer('head'), 'event.manage', 'E-01', YES)).toBe(true)
  })

  // **대상을 모르면 조건이 없는 것과 같아진다.** 열어 두면 '어느 행사인지 모르지만
  // 되기는 된다'가 된다.
  it('조건이 대상을 요구하는데 대상이 없으면 막는다', async () => {
    expect(await can(viewer('head'), 'event.manage', null, YES)).toBe(false)
    // 회장단은 대상과 무관하게 되므로 영향이 없다.
    expect(await can(viewer('chair'), 'event.manage', null, NO)).toBe(true)
  })

  // 조직 역할이 답하지 않는 자리. ORG-04이 표 아래에 따로 적어 둔 것이다.
  it('회의 진행은 회장단이라도 진행 권한자가 아니면 막는다', async () => {
    expect(await can(viewer('chair'), 'meeting.run', 'MT-01', NO)).toBe(false)
    expect(await can(viewer('member'), 'meeting.run', 'MT-01', YES)).toBe(true)
  })

  it('회의 수정·취소·진행 권한 부여는 생성자만 한다', async () => {
    const only생성자: Lookups = { ...NO, isMeetingCreator: async () => true }
    expect(await can(viewer('chair'), 'meeting.own', 'MT-01', NO)).toBe(false)
    expect(await can(viewer('member'), 'meeting.own', 'MT-01', only생성자)).toBe(true)
  })

  it('로그인 없이 열리는 자리만 로그인 없이 열린다', async () => {
    expect(await can(null, 'public', null, NO)).toBe(true)
    expect(await can(null, 'member', null, NO)).toBe(false)
    expect(await can(null, 'signedIn', null, NO)).toBe(false)
  })

  // 학생회를 만들거나 초대 코드를 확인하는 사람은 아직 어느 구성원도 아니다.
  it('구성원이 아니어도 여는 자리가 따로 있다', async () => {
    expect(await can(로그인만, 'signedIn', null, NO)).toBe(true)
    expect(await can(로그인만, 'member', null, NO)).toBe(false)
    expect(await can(로그인만, 'finance.read', null, NO)).toBe(false)
  })

  // **지어내지 않는다.** 명세가 말하지 않은 자리를 열어 두면 규칙 없이 열려 있고
  // 아무도 그 사실을 모른다.
  it('명세가 아직 말하지 않은 자리는 막는다', async () => {
    for (const role of ['chair', 'head', 'member'] as Role[]) {
      expect(await can(viewer(role), 'unstated', null, YES)).toBe(false)
    }
  })

  it('모르는 영역을 물으면 던진다', async () => {
    await expect(can(viewer('chair'), '없는영역', null, NO)).rejects.toBeInstanceOf(UnknownArea)
  })

  // 명세의 영역이 하나라도 판정되지 않으면 그 자리는 요청이 올 때 터진다.
  it('명세의 모든 영역을 판정할 수 있다', async () => {
    for (const area of permissionsJson.areas) {
      for (const role of ['chair', 'head', 'member'] as Role[]) {
        await expect(
          can(viewer(role, { finance: true }), area.key, 'X-1', YES),
        ).resolves.toBeTypeOf('boolean')
      }
    }
  })

  // 계약이 드는 영역과 정책이 아는 영역이 갈리면, 갈린 자리는 요청이 올 때 터진다.
  it('계약이 드는 모든 영역을 정책이 안다', async () => {
    const known = new Set(permissionsJson.areas.map((area) => area.key))
    const used = new Set<string>()
    for (const item of Object.values(openapi.paths)) {
      for (const operation of Object.values(item as Record<string, { 'x-authorize'?: { area: string } }>)) {
        const area = operation['x-authorize']?.area
        if (area !== undefined) used.add(area)
      }
    }
    expect(used.size).toBeGreaterThan(10)
    expect([...used].filter((area) => !known.has(area))).toEqual([])
  })
})
