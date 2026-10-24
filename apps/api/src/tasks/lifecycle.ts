import { TASK_STATUSES, type TaskResultStage, type TaskStatus } from '@vada/contracts'

// 업무 상태 규칙 한 곳(DEC-39, DEC-82, RULE-41). 서비스, 읽기, 결과물 동기화가 같은 규칙을 부르고 화면은 다시 세지 않는다.

// 상태 차례: 할 일 < 진행 중 < 끝남
const rankOf = (status: TaskStatus) => TASK_STATUSES.indexOf(status)

// 카드의 다음 단계: 할 일 → 진행 중 → 끝남, 끝남은 없다. 끝난 업무를 되돌리는 것은 사람이 상세에서 한다.
export const nextOf = (status: TaskStatus): TaskStatus | null =>
  TASK_STATUSES[rankOf(status) + 1] ?? null

// 사람의 이동: 셋 사이 어디로든 된다. 같은 값이면 옮기지 않는다(null, 판 없음).
export const humanMoveOf = (from: TaskStatus, to: TaskStatus): TaskStatus | null =>
  from === to ? null : to

// 저절로 이동: 목표가 지금보다 앞일 때만 목표로 옮긴다. 같거나 뒤면 옮기지 않아 사람이 바꾼 상태를 덮지 않는다.
export const autoMoveOf = (from: TaskStatus, target: TaskStatus): TaskStatus | null =>
  rankOf(target) > rankOf(from) ? target : null

// 결과물 단계(RULE-41): 없음 < 진행 중 < 끝남. 빠짐은 차례에 없고 목표 셈에서 뺀다.
const STAGE_ORDER = ['none', 'in_progress', 'finished'] as const
const stageRank = (stage: TaskResultStage) =>
  stage === 'excluded' ? -1 : STAGE_ORDER.indexOf(stage)

// 쓰기 하나가 결과물의 단계를 올렸는가. 같거나 내려갔거나 빠짐이 되면 아니다: 그런 쓰기는 업무를 건드리지 않는다.
export const isRaised = (before: TaskResultStage, after: TaskResultStage) =>
  after !== 'excluded' && stageRank(after) > stageRank(before)

// 업무의 목표 상태: 빠지지 않은 결과물 단계 가운데 가장 낮은 것. 모두 끝나야 끝남이다. 단계가 없음이면 할 일이다.
// 빠지지 않은 결과물이 없으면 목표가 없다(null).
const TARGET_OF_STAGE: Record<TaskResultStage, TaskStatus | null> = {
  none: 'todo',
  in_progress: 'in_progress',
  finished: 'done',
  excluded: null,
}
export function targetOf(stages: readonly TaskResultStage[]): TaskStatus | null {
  const alive = stages.filter(stage => stage !== 'excluded')
  if (!alive.length) return null
  const lowest = alive.reduce((low, stage) => (stageRank(stage) < stageRank(low) ? stage : low))
  return TARGET_OF_STAGE[lowest]
}
