import type { EventSummary, TaskDetail } from '@vada/contracts'
import { useEvents } from '../events/useEvents'
import { linkableEventsOf } from './task-form-options'
import { useTaskOptions } from './useTaskOptions'

// 고를 행사: 이 업무의 부서로 이을 수 있는 것만이다(DEC-94). 행사 목록과 이을 수 있는 행사를 다 읽기 전에는 ready가 아니다.
export function useLinkableEvents(
  councilId: string,
  task: Pick<TaskDetail, 'department'>,
  onForbidden: () => void,
): { ready: boolean; list: EventSummary[] } {
  const events = useEvents(councilId, onForbidden)
  const options = useTaskOptions(councilId, undefined, onForbidden)
  if (events.state.kind !== 'ready' || options.state.kind !== 'ready')
    return { ready: false, list: [] }
  const { linkableEvents } = options.state.options
  const departmentId = task.department?.id ?? null
  return {
    ready: true,
    list: linkableEventsOf(events.state.data.events, linkableEvents, departmentId),
  }
}
