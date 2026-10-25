import { statusOf, type EventSettlementsResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { eventSettlementsPath } from './finance-api'

// 재정 '행사 정산' 탭의 행사와 정산 남은 것 수. 화면이 보이는 동안 15초마다, 다시 보일 때 읽는다.
// 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useEventSettlements(councilId: string, onForbidden: () => void) {
  return usePolledRead<EventSettlementsResponse>(eventSettlementsPath(councilId), status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
}
