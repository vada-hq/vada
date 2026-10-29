import { NO_ASSIGNEE_LABEL } from '../tasks/task-view'

// 막힌 곳의 수: 0이 아닌 것만, 업무 화면 묶음 머리와 같은 색으로(지남 빨강, 담당자 없음 노랑).
export function riskParts({ overdue, unassigned }: { overdue: number; unassigned: number }) {
  return [
    overdue > 0 && (
      <span key="overdue" className="font-medium text-danger-emphasis">
        지남 {overdue}
      </span>
    ),
    unassigned > 0 && (
      <span key="unassigned" className="font-medium text-warning">
        {NO_ASSIGNEE_LABEL} {unassigned}
      </span>
    ),
  ]
}
