import { describe, expect, it } from 'vitest'
import { dataSourceCallsOf } from './screen-sources'
import { org04b } from './screens'

// **빈 열쇠로는 묻지 않는다.**
//
// 미리 받는 자리가 화면의 인자를 그대로 풀어 부른다. 화면이 아직 아무것도 안 고른
// 채로 열리면 그 인자가 빈 줄이 되는데, 그대로 나가면 주소가
// `/api/org/members//role-assignment`가 되고 서버는 남의 것을 묻는 것으로 보아 막는다.
// 그러면 **화면이 열자마자 통째로 죽는다** — ORG-04B가 그랬고, 배포 모양으로 걷는
// 카나리가 찾았다(2026-09-05).
//
// 열쇠를 아예 빠뜨린 것은 이미 막고 있었다(`data-sources/required-params.test.ts`).
// 빈 줄은 그 그물을 빠져나갔다 — `undefined`가 아니기 때문이다.

describe('그리기 전에는 모르는 것을 묻지 않는다', () => {
  it('필수 인자가 빈 줄인 부름은 미리 받지 않는다', () => {
    // ORG-04B는 고른 사람의 역할을 읽는다. 아무 인자도 없이 열면 그 사람이 없다.
    const calls = dataSourceCallsOf(org04b, { screenParams: {} })
    expect(calls.map((call) => call.key)).not.toContain('org.selectedRoleAssignment')
    // 열쇠가 필요 없는 것들은 그대로 미리 받는다.
    expect(calls.map((call) => call.key)).toContain('org.roleAssignments')
  })

  // 이 화면의 열쇠는 주소가 아니라 **고른 것**에서 온다(`fieldKey`). 그 값이 있으면
  // 미리 받는다 — 빈 줄일 때만 미룬다.
  it('고른 것이 있으면 미리 받는다', () => {
    const calls = dataSourceCallsOf(org04b, { fields: { selectedMemberId: 'M-01' } })
    const found = calls.find((call) => call.key === 'org.selectedRoleAssignment')
    expect(found?.params).toEqual({ memberId: 'M-01' })
  })
})
