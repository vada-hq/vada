import {
  ACTIONS,
  type Action,
  type CouncilRank,
  type CouncilView,
  type MemberAction,
  type MyCouncil,
  type PlacementAction,
  type TeamResponse,
} from '@vada/contracts'

// 화면 시험이 같이 쓰는 학생회 응답. 값은 서버 응답과 같은 모양이다.
const defaultTitles = {
  president: '회장',
  vicePresident: '부회장',
  head: '부장',
  viceHead: '부부장',
}
// 서버의 내 권한 목록(permissionsOf)과 같다. 방 칸(chat.use)과 요청한 사람 칸(purchase.cancel)은 맥락이 있어야 맞아서 목록에 없고,
// 재정 칸은 직급으로 물려받지 않아 재정부만 가진다.
export const MEMBER_PERMISSIONS: Action[] = ['council.view', 'chat.direct', 'purchase.request']
const FINANCE_ONLY: Action[] = [
  'purchase.approve',
  'finance.manage',
  'closing.view_draft',
  'fee_payment.manage',
]
// 부서 직급이 있어야 맞아서 직급 부서가 없는 회장단은 없다.
const NEEDS_CONTEXT: Action[] = ['chat.use', 'purchase.cancel', 'purchase.view_department']
// 재정부는 납부자 명단 보기와 신청자 정보 보기도 가진다(서버표의 finance 기준).
export const FINANCE_PERMISSIONS: Action[] = [
  ...MEMBER_PERMISSIONS,
  ...FINANCE_ONLY,
  'fee_payment.view',
  'registration.view_applicants',
]
export const LEADER_PERMISSIONS: Action[] = ACTIONS.filter(
  action =>
    action !== 'president.transfer' &&
    !NEEDS_CONTEXT.includes(action) &&
    !FINANCE_ONLY.includes(action),
)
export const PRESIDENT_PERMISSIONS: Action[] = ACTIONS.filter(
  action => !NEEDS_CONTEXT.includes(action) && !FINANCE_ONLY.includes(action),
)

export const myCouncil = (
  id = 'c1',
  name = '컴퓨터학부 학생회',
  councilRank: CouncilRank | null = 'president',
): MyCouncil => ({
  id,
  name,
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  councilRank,
  departments: [],
})

export function councilView(
  id = 'c1',
  options: {
    name?: string
    councilRank?: CouncilRank | null
    permissions?: Action[]
    memberId?: string | undefined
    departments?: CouncilView['me']['departments']
  } = {},
): CouncilView {
  const councilRank = options.councilRank === undefined ? 'president' : options.councilRank
  return {
    council: {
      id,
      name: options.name ?? '컴퓨터학부 학생회',
      unit: 'department',
      schoolName: '한양대학교 ERICA',
      titles: defaultTitles,
    },
    cohort: { id: `${id}-2026`, name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
    me: {
      memberId: options.memberId ?? 'm1',
      name: '김회장',
      councilRank,
      departments: options.departments ?? [],
    },
    permissions:
      options.permissions ??
      (councilRank === 'president'
        ? PRESIDENT_PERMISSIONS
        : councilRank
          ? LEADER_PERMISSIONS
          : MEMBER_PERMISSIONS),
  }
}

// 운영진 줄의 동작은 서버 team/policy.ts가 읽는 사람마다 낸다. 여기 값은 김회장(m1)으로 읽은 견본이다:
// 회장(넘기기까지), 회장단(회장 넘기기 없음), 직급 없는 운영진(없음). 회장 줄과 내 줄에는 내보내기·직급이 없다.
export type TeamViewer = 'president' | 'leader' | 'member'
const OTHERS: Record<TeamViewer, MemberAction[]> = {
  president: [
    'member.assign_department',
    'member.change_rank',
    'member.hand_over_president',
    'member.remove',
  ],
  leader: ['member.assign_department', 'member.change_rank', 'member.remove'],
  member: [],
}
const placement = (viewer: TeamViewer): PlacementAction[] =>
  viewer === 'member' ? [] : ['placement.remove']
export const teamMemberActions = (viewer: TeamViewer) => ({
  self: viewer === 'member' ? [] : (['member.assign_department'] as MemberAction[]),
  others: OTHERS[viewer],
  placement: placement(viewer),
})

// 회장 김회장(m1), 재정부 부장 이재정(m2), 부서 없는 박새내(m3). 재정부(d1)와 기획부(d2)가 있다.
export function teamResponse(viewer: TeamViewer = 'president'): TeamResponse {
  const actions = teamMemberActions(viewer)
  return {
    members: [
      {
        id: 'm1',
        name: '김회장',
        councilRank: 'president',
        departments: [],
        joinedAt: '2026-10-01T01:00:00.000Z',
        actions: actions.self,
      },
      {
        id: 'm2',
        name: '이재정',
        councilRank: null,
        departments: [{ id: 'd1', rank: 'head', actions: actions.placement }],
        joinedAt: '2026-10-02T01:00:00.000Z',
        actions: actions.others,
      },
      {
        id: 'm3',
        name: '박새내',
        councilRank: null,
        departments: [],
        joinedAt: '2026-10-18T15:30:00.000Z',
        actions: actions.others,
      },
    ],
    departments: [
      { id: 'd1', name: '재정부', role: 'finance', memberCount: 1 },
      { id: 'd2', name: '기획부', role: null, memberCount: 0 },
    ],
  }
}
