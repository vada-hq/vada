import { statusOf, type EventDetail, type EventResponse } from '@vada/contracts'
import { EVENT_LOST, PERMISSION_CHANGED } from '@/lib/messages'
import { usePolledRead } from '@/lib/use-polled-read'
import { eventPath } from './event-api'
import type { EventDialogHandlers } from './useEventSubmit'

// 행사 하나. 화면이 보이는 동안 15초마다, 다시 보일 때 다시 읽는다. 사라졌거나(404) 권한을 잃으면(403) 부모가 닫고 이유를 보인다.
// 내 변경이 돌려준 행사는 바로 화면의 값이 되고, 아직 오지 않은 이전 읽기의 응답은 버린다.
export function useEventDetail(councilId: string, eventId: string, handlers: EventDialogHandlers) {
  const read = usePolledRead<EventResponse>(eventPath(councilId, eventId), status => {
    if (status === statusOf('NOT_FOUND')) return handlers.onLost(EVENT_LOST)
    if (status !== statusOf('FORBIDDEN')) return
    handlers.onForbidden()
    handlers.onLost(PERMISSION_CHANGED)
  })
  const { replace } = read
  return {
    state: read.state,
    reload: read.reload,
    replace: (event: EventDetail) => replace({ event }),
  }
}
