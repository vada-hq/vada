import type { HomeBoardEventRef } from './home.js'
import type { HomeOpsPerson } from './home-ops.js'
import type { TaskSummary } from './tasks.js'

// 회장단 홈 ③ '내가 할 일'(c35 확정 시안, 시연 조각 ㉯). 서버가 갈래·차례·셈을 정하고 화면은 그리기만 한다(DEC-38).

// 갈래. 차례도 이 순서다(확인할 것 → 업무 지남 → 오늘 마감).
export const HOME_TODO_KINDS = ['minutes', 'event_tidy', 'task_late', 'task_today'] as const
export type HomeTodoKind = (typeof HOME_TODO_KINDS)[number]
// 화면이 처음에 그리는 줄 수. 넘으면 '전체 n건 보기'로 홈 안에서 펼친다.
export const HOME_TODO_SHOWN = 5
// 서버가 보내는 줄 상한. 펼친 목록이 이만큼까지다(갈래별 수는 전체를 센다).
export const HOME_TODO_ROW_LIMIT = 50

export type HomeTodoRow =
  | {
      // 내가 만든(만든 사람이 떠났으면 회장단 모두의) 끝났고 확정·취소 전이며 회의록 글이 있는 회의
      kind: 'minutes'
      meeting: { id: string; title: string; endsAt: string | null }
      // 빼지 않은 결정 수와 취소하지 않은 후속 업무 수(확정 버튼 옆의 수와 같은 셈, DEC-104)
      decisions: number
      followUps: number
    }
  | {
      // 끝났고 완료하지 않은 행사(재정 '행사 정산' 탭과 같은 행사·차례)
      kind: 'event_tidy'
      event: HomeBoardEventRef
      endedDays: number | null
      remaining: { tasks: number; settlement: number }
      // 정산이 남았고 재정부장이 있고 내가 아닐 때만
      settlementContact: HomeOpsPerson | null
      // 묻기는 아직 없어 늘 비어 있다.
      actions: 'ask'[]
    }
  | {
      // 담당자가 나이거나 다른 회장단인 업무의 지남·오늘 마감(①에서 빼는 업무와 같은 조건)
      kind: 'task_late' | 'task_today'
      task: TaskSummary
      // task_late: 지난 날 수, task_today: 0
      days: number
      // 회장단 업무의 담당자(나 아닌 회장단). 내 업무면 null.
      owner: HomeOpsPerson | null
    }

export interface HomeTodo {
  // 갈래 차례로 HOME_TODO_ROW_LIMIT줄까지. 업무 지남은 오래된 것부터다.
  rows: HomeTodoRow[]
  counts: Record<HomeTodoKind, number>
  total: number
  // 머리 얼굴(나)의 색 번호(①과 같은 규칙)
  meTint: number
}
