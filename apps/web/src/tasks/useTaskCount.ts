import { overdueOf } from './task-view'
import { useTasks } from './useTasks'

// 옆 메뉴 '업무'의 '지남 N'. 내 업무 중 끝나지 않은 것에서 지난 것만 센다. 업무 화면이 목록을 바꾸면 tasks.reload로 다시 읽는다.
export function useTaskCount(councilId: string, onForbidden: () => void, enabled: boolean) {
  const tasks = useTasks(councilId, { view: 'mine', filter: 'open' }, onForbidden, enabled)
  const { state } = tasks
  const count = state.kind === 'ready' ? overdueOf(state.tasks, state.truncated) : null
  return { tasks, count }
}
