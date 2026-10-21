import { countOf } from './task-view'
import { useTasks } from './useTasks'

// 옆 메뉴 '업무'의 수. 내 업무 중 끝나지 않은 것에서 센다. 업무 화면이 목록을 바꾸면 tasks.reload로 다시 읽는다.
export function useTaskCount(councilId: string, onForbidden: () => void, enabled: boolean) {
  const tasks = useTasks(councilId, { view: 'mine', filter: 'open' }, onForbidden, enabled)
  const { state } = tasks
  const count = state.kind === 'ready' ? countOf(state.tasks, state.truncated) : null
  return { tasks, count }
}
