import type { HomeKind } from '@vada/contracts'

// 홈 종류 → 배치 꼴과 카드 자리(DEC-95, 명세 027 정한 것 7). 카드 이름은 와이어프레임 그대로이고 바뀐 셋('결재 대기',
// '필요한 때 가까운 품목', '내 요청')은 DEC-95가 정했다. 홈 종류는 서버가 고르고 화면은 다시 세지 않는다(DEC-38).
// 회장단: 가로 전체 카드 → 3열 → 맨 아래 한 줄. 나머지: 2×2(왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래).
type CouncilPlan = {
  layout: 'council'
  top: string
  columns: readonly [string, string, string]
  bottom: string
}
type GridPlan = { layout: 'grid'; cards: readonly [string, string, string, string] }

export const HOME_PLANS = {
  council: {
    layout: 'council',
    top: '전체 행사 진행 현황',
    columns: ['확인이 필요한 운영 상황', '후속 정리 중인 행사', '가까운 주요 일정'],
    bottom: '전체 재정 요약',
  },
  department: {
    layout: 'grid',
    cards: ['우리 부서 참여 행사', '가까운 일정·마감', '부서 구매 진행', '확인이 필요한 일'],
  },
  member: {
    layout: 'grid',
    cards: ['참여 행사 진행', '가까운 일정', '내 요청', '내 업무·메시지'],
  },
  finance: {
    layout: 'grid',
    cards: ['결재 대기', '필요한 때 가까운 품목', '예외·대기', '행사별 예산'],
  },
} as const satisfies { council: CouncilPlan } & Record<Exclude<HomeKind, 'council'>, GridPlan>
