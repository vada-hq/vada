import { statusOf, type SettlementResponse } from '@vada/contracts'
import { EVENT_LOST, PERMISSION_CHANGED } from '@/lib/messages'
import { usePolledRead } from '@/lib/use-polled-read'
import { eventPath } from './event-api'
import type { EventDialogHandlers } from './useEventSubmit'

// 행사의 정산. 화면이 보이는 동안 15초마다, 다시 보일 때 다시 읽는다. 사라졌거나(404) 권한을 잃으면(403) 부모가 닫고 이유를 보인다.
export function useSettlement(councilId: string, eventId: string, handlers: EventDialogHandlers) {
  return usePolledRead<SettlementResponse>(
    `${eventPath(councilId, eventId)}/settlement`,
    status => {
      if (status === statusOf('NOT_FOUND')) return handlers.onLost(EVENT_LOST)
      if (status !== statusOf('FORBIDDEN')) return
      handlers.onForbidden()
      handlers.onLost(PERMISSION_CHANGED)
    },
  )
}
