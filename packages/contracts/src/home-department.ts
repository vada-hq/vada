import type { HomeOps } from './home-ops.js'
import type { HomeEventLanes } from './home-lanes.js'
import type { HomeTodo } from './home-todo.js'
import type { HomeWeek } from './home-week.js'

// 시연용 임시: 우리 부서가 맡은 예산 한 줄(대표 10/30, notes dept-home-content.md). 시연 학생회에만 온다.
// 시연 뒤 budget_item 담당 부서로 바꾼다(남음 = 그 항목 예산 - 결재된 구매 요청).
export interface HomeDepartmentBudget {
  name: string
  amount: number
  remaining: number
}

// 부장 홈(HOME-01D, 10/30 확정): 회장단 홈과 같은 구역·부품에 부장 범위의 데이터만 싣는다(DEC-38).
// 부장·부부장인 부서(직급 부서) 업무·행사로 좁히고, 회장단 전용(부서 미정·미배정 구성원·재정 담당·결재 대기)은 싣지 않는다.
// 재정부 겸직은 재정부 홈이다.
export interface HomeDepartmentBoard {
  // ① 직급 부서 업무의 지남·오늘·내일. 연락할 사람은 그 업무의 담당자이고, 담당자 없는 업무는 assign(by: 'head')로 센다.
  ops: HomeOps
  // ③ 내 업무의 지남·오늘 + 내가 만든 회의록 + 우리 부서 행사 정리
  todo: HomeTodo
  // ⑤ 회장단 홈과 같다(다음 회의는 내가 볼 수 있는 회의).
  week: HomeWeek
  // ② 우리 부서가 맡은 행사(그 행사에 이은 끝나지 않은 업무를 직급 부서가 맡음, EventDetail.departments와 같은 뜻)
  lanes: HomeEventLanes
  budget: HomeDepartmentBudget | null
}
