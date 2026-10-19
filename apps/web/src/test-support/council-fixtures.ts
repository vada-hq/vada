import {
  ACTIONS,
  type Action,
  type CouncilRank,
  type CouncilView,
  type MyCouncil,
  type TeamResponse,
} from '@vada/contracts'

// 화면 시험이 같이 쓰는 학생회 응답. 값은 서버 응답과 같은 모양이다.
export const defaultTitles = {
  president: '회장',
  vicePresident: '부회장',
  head: '부장',
  viceHead: '부부장',
}
export const MEMBER_PERMISSIONS: Action[] = ['council.view']
export const LEADER_PERMISSIONS: Action[] = ACTIONS.filter(
  action => action !== 'president.transfer',
)
export const PRESIDENT_PERMISSIONS: Action[] = [...ACTIONS]

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
    me: { memberId: options.memberId ?? 'm1', name: '김회장', councilRank, departments: [] },
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
