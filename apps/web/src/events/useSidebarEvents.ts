import { statusOf, type SidebarEventsResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { sidebarEventsPath } from './event-api'
import { useEventsChanged } from './events-changed'

// 옆 메뉴 '공간'의 완료하지 않은 행사. 옆 메뉴의 다른 목록처럼 학생회 정보가 읽힌 뒤(enabled), 화면이 보이는 동안 15초마다,
// 다시 보일 때 읽고, 행사를 바꾼 뒤에는 바로 다시 읽는다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useSidebarEvents(councilId: string, onForbidden: () => void, enabled: boolean) {
  const read = usePolledRead<SidebarEventsResponse>(
    sidebarEventsPath(councilId),
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
    enabled,
  )
  useEventsChanged(() => void read.reload())
  return read
}
