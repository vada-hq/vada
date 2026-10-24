import { useRegistrationForms } from '../registrations/useRegistrationForms'
import { useTasks } from '../tasks/useTasks'
import { useSettlement } from './useSettlement'
import type { EventDialogHandlers } from './useEventSubmit'

// 개요가 같이 보이는 세 탭의 요약: 끝나지 않은 업무, 신청 양식(신청자 정보 없이 수만), 정산.
// 신청자 목록은 읽을 때마다 열람 기록이 남으므로 읽지 않는다. 세 읽기 모두 각 탭과 같은 경로·같은 권한 처리다.
export function useEventOverview(
  councilId: string,
  eventId: string,
  handlers: EventDialogHandlers,
) {
  const tasks = useTasks(councilId, { view: 'all', filter: 'open', eventId }, handlers.onForbidden)
  const forms = useRegistrationForms(councilId, eventId, handlers)
  const settlement = useSettlement(councilId, eventId, handlers)
  return { tasks: tasks.state, forms: forms.state, settlement: settlement.state }
}
