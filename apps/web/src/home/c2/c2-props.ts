// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(e1~e6)은 읽기만 한다. 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
import type { C2Data, C2Event, C2Signal } from './c2-data'

// 각 안(eN/index.tsx의 기본 내보내기)이 받는 것. 모양은 안마다 다르고 받는 것은 같다.
// 행동(명세 5절)은 모두 미리보기 껍데기가 처리한다(콘솔에 '[c2] …'만 찍고 아무 일도 하지 않는다).
// 신호마다 테두리 버튼을 달지 않는다. 신호 글 자체가 누르는 자리다(명세 5절, 390에서 44px 이상).
export type C2Props = {
  data: C2Data
  // 행사 보기: 행사 이름(또는 줄)을 누름 → 행사 화면 개요
  onOpen: (event: C2Event) => void
  // 늦은 부서 보기: '기획부 지남 1'을 누름 → 행사 업무 탭(그 부서·지남 거르기)
  onLate: (event: C2Event, department: string) => void
  // 신청 보기: 신청 현황을 누름 → 행사 신청자 탭
  onRegistrations: (event: C2Event) => void
  // 미정 정하기: '장소 미정'을 누름 → 행사 개요 고치기
  onDecide: (event: C2Event, field: string) => void
  // 예산 보기: 예산 예외를 누름 → 행사 예산 탭
  onBudget: (event: C2Event) => void
  // 전체 보기: '전체 n개 보기' 링크 → 행사 목록
  onSeeAll: () => void
  // 새 행사: 빈 상태 버튼(data.canCreate일 때만) → 새 행사 만들기
  onCreate: () => void
}

// 신호 하나를 누르면 할 행동. 신호를 그리는 쪽이 갈래마다 콜백을 고르지 않아도 되게 둔다(써도 되고 안 써도 된다).
export function signalAction(props: C2Props, event: C2Event, signal: C2Signal): () => void {
  switch (signal.kind) {
    case 'registration':
      return () => props.onRegistrations(event)
    case 'undecided':
      return () => props.onDecide(event, signal.field)
    case 'late':
      return () => props.onLate(event, signal.department)
    case 'budget':
      return () => props.onBudget(event)
  }
}
