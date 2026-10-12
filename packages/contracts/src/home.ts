import type { EventPhase } from './events.js'
import type { ExpenseSummary } from './expenses.js'
import type { EventSummary } from './index.js'
import type { TaskSummary } from './tasks.js'

// 운영 현황(M6). 완료하지 않은 행사에서 멈춘 일을 모은다. 줄 목록은 종류마다 이만큼까지 오래된 것부터 주고, 수(counts)는 자르지 않는다.
export const HOME_TASKS_MAX = 100
export const HOME_EXPENSES_MAX = 100
// 멈춘 일의 종류. 이 순서가 줄 순서다(행사 마무리 → 업무 → 돈).
export const HOME_ITEM_KINDS = ['completion_pending', 'settlement_pending', 'task_overdue', 'tasks_unassigned', 'purchases_pending',
  'purchases_late', 'expense_no_evidence', 'fees_unconfirmed'] as const
export type HomeItemKind = typeof HOME_ITEM_KINDS[number]
export interface HomeTaskCounts { open: number; overdue: number; done: number }
export interface HomeEvent {
  event: EventSummary
  // 완료한 행사는 오지 않는다.
  phase: Exclude<EventPhase, 'completed'>
  tasks: { total: number; done: number; overdue: number; unassigned: number }
  // 참가 신청이 없으면 null이다. registered는 취소하지 않은 신청 수(결과보고서와 같다)이고 closesAt은 한국 시각이다.
  registration: { registered: number; capacity: number | null; closesAt: string; accepting: boolean } | null
  settled: boolean
}
type Named = { id: string; name: string }
export type HomeItem =
  | { kind: 'task_overdue'; eventId: string; task: TaskSummary }
  | { kind: 'tasks_unassigned'; eventId: string; department: Named | null; count: number }
  // since는 가장 오래된 제출 시각(ISO)이다.
  | { kind: 'purchases_pending'; eventId: string; count: number; since: string }
  // neededBy는 가장 이른 필요한 날이다.
  | { kind: 'purchases_late'; eventId: string; count: number; neededBy: string }
  // 상시 운영 지출이면 eventId가 null이다.
  | { kind: 'expense_no_evidence'; eventId: string | null; expense: ExpenseSummary }
  | { kind: 'fees_unconfirmed'; eventId: string; count: number }
  // endedOn은 행사가 끝난 한국 날짜다. blockers는 정산을 막는 것(정산 조건과 같다)이다.
  // feePeriodMissing은 받은 참가비가 있는데 행사가 회계 기간에 없다는 뜻이다(참가비 수입을 넣을 곳이 없다).
  | { kind: 'settlement_pending'; eventId: string; endedOn: string
      blockers: { missingEvidence: number; pendingRequests: number; unrecordedItems: number; feePeriodMissing: boolean } }
  | { kind: 'completion_pending'; eventId: string; endedOn: string }
export interface HomeDepartment { id: string; name: string; isLeadership: boolean; handlesFinance: boolean; tasks: HomeTaskCounts }
export interface HomeResponse {
  // 서버의 한국 날짜(YYYY-MM-DD). 화면은 며칠 지났는지를 이 날로 센다.
  today: string
  events: HomeEvent[]
  departments: HomeDepartment[]
  // 담당 부서가 없는 업무
  unownedTasks: HomeTaskCounts
  items: HomeItem[]
  counts: Record<HomeItemKind, number>
  // 지연 업무나 증빙 없는 지출이 상한을 넘어 줄 일부만 왔다.
  truncated: boolean
}
