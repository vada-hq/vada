import {
  ACTIONS,
  type Action,
  type CouncilRank,
  type CouncilView,
  type MyCouncil,
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
const FINANCE_ONLY: Action[] = ['purchase.approve', 'finance.manage', 'fee_payment.manage']
const NEEDS_CONTEXT: Action[] = ['chat.use', 'purchase.cancel', 'event.update']
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
): MyCouncil => ({ id, name, councilRank, departments: [] })

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

// 회장 김회장(m1), 재정부 부장 이재정(m2), 부서 없는 박새내(m3). 재정부(d1)와 기획부(d2)가 있다.
export function teamResponse(): TeamResponse {
  return {
    members: [
      {
        id: 'm1',
        name: '김회장',
        councilRank: 'president',
        departments: [],
        joinedAt: '2026-10-01T01:00:00.000Z',
      },
      {
        id: 'm2',
        name: '이재정',
        councilRank: null,
        departments: [{ id: 'd1', rank: 'head' }],
        joinedAt: '2026-10-02T01:00:00.000Z',
      },
      {
        id: 'm3',
        name: '박새내',
        councilRank: null,
        departments: [],
        joinedAt: '2026-10-18T15:30:00.000Z',
      },
    ],
    departments: [
      { id: 'd1', name: '재정부', role: 'finance', memberCount: 1 },
      { id: 'd2', name: '기획부', role: null, memberCount: 0 },
    ],
  }
}
