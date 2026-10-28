import type { TaskResultKind, TaskResultStage, TaskSummary } from '@vada/contracts'

// 업무 상세의 결과물 묶음에 쓰는 이름. 같은 대상은 다른 화면과 같은 이름으로 부른다.
export const RESULT_KIND_LABEL: Record<TaskResultKind, string> = {
  request: '구매 요청',
  registration_form: '신청 양식',
  message: '공지',
  event: '행사',
}

export const makeLabel = (kind: TaskResultKind) => `${RESULT_KIND_LABEL[kind]} 만들기`

// 단계 칩. 없음(일이 아직 없음)은 칩을 달지 않는다.
export const STAGE_CHIP: Record<
  TaskResultStage,
  { label: string; tone: 'info' | 'success' | 'neutral' } | null
> = {
  none: null,
  in_progress: { label: '진행 중', tone: 'info' },
  finished: { label: '끝남', tone: 'success' },
  excluded: { label: '취소', tone: 'neutral' },
}

export function resultSummaryLine(task: TaskSummary) {
  const result = task.latestResult
  if (!result) return null
  const rest = (task.resultCount ?? 1) - 1
  const state = STAGE_CHIP[result.stage]?.label ?? '없음'
  return `${RESULT_KIND_LABEL[result.kind]} · ${state}${rest > 0 ? ` 외 ${rest}` : ''}`
}
