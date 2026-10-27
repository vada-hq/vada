import { useMemo } from 'react'
import { koreanDateOf, type CouncilView } from '@vada/contracts'
import { useNow } from '@/lib/use-now'
import { inHomeTaskScope, type HomeTaskScope } from './home-task-scope'
import type { TaskList } from './useTasks'

// 부서를 고른 보기는 그 부서의 업무만 남긴다(홈의 부서 줄이 연다).
// 새 배열이 렌더마다 만들어지면 표가 목록이 바뀐 줄로 알고 고른 값을 지우므로, 읽은 목록이 바뀔 때만 다시 만든다.
export function useNarrowed(
  list: TaskList,
  department: string | null,
  scope: HomeTaskScope,
  council: CouncilView,
): TaskList {
  const { state, reload } = list
  const today = koreanDateOf(useNow())
  const { heads, attention, week, assignee } = scope
  return useMemo(() => {
    if (state.kind !== 'ready') return { state, reload }
    const tasks = state.tasks.filter(
      task =>
        (department === null || task.department?.id === department) &&
        inHomeTaskScope(task, { heads, attention, week, assignee }, council, today),
    )
    return { reload, state: { ...state, tasks } }
  }, [state, reload, department, heads, attention, week, assignee, council, today])
}
