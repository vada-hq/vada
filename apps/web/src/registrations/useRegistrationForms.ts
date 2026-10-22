import { statusOf, type RegistrationFormsResponse } from '@vada/contracts'
import { EVENT_LOST, PERMISSION_CHANGED } from '@/lib/messages'
import { usePolledRead } from '@/lib/use-polled-read'
import { formsPath } from './registration-api'

type Handlers = { onForbidden: () => void; onLost: (message: string) => void }

// 행사의 신청 양식 목록. 신청자 정보가 없어 15초마다 읽어도 열람 기록이 남지 않는다.
// 권한을 잃으면(403) 학생회를 다시 읽게 하고, 행사가 사라졌으면(404) 부모가 행사 화면을 닫는다.
export function useRegistrationForms(councilId: string, eventId: string, handlers: Handlers) {
  return usePolledRead<RegistrationFormsResponse>(formsPath(councilId, eventId), status => {
    if (status === statusOf('NOT_FOUND')) return handlers.onLost(EVENT_LOST)
    if (status !== statusOf('FORBIDDEN')) return
    handlers.onForbidden()
    handlers.onLost(PERMISSION_CHANGED)
  })
}
