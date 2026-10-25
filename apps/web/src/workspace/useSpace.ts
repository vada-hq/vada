import { useState } from 'react'
import type { SidebarEvent } from '@vada/contracts'
import { canCreateEvent } from '../events/event-view'
import type { SpaceProps } from './SpaceList'
import type { CouncilData } from './useCouncilData'
import type { useWorkspaceNav } from './useWorkspaceNav'

// 옆 메뉴 '공간' 묶음의 값과 [+ 새 행사] 창의 상태. 옆 메뉴는 넓은 화면과 서랍에 둘 그려지므로 창은 작업 공간에 하나만 둔다.
// 서랍에서 누르면 서랍을 닫고 창을 연다. 권한을 잃어 창이 닫히면 그 이유를 묶음 아래에 보인다.
export function useSpace(
  data: CouncilData,
  nav: ReturnType<typeof useWorkspaceNav>,
  openEvents: SidebarEvent[] | null,
) {
  const [creating, setCreating] = useState(false)
  const [lost, setLost] = useState<string | null>(null)
  const canCreate = data.view !== null && canCreateEvent(data.view)
  const space: SpaceProps = {
    events: openEvents,
    onOpenEvent: nav.openEvent,
    onSeeAll: () => nav.openPage('events'),
    onNewEvent: canCreate
      ? () => {
          nav.closeNav()
          setLost(null)
          setCreating(true)
        }
      : undefined,
    lost,
  }
  const newEvent = {
    open: creating && data.view !== null,
    close: () => setCreating(false),
    lose: (message: string) => {
      setCreating(false)
      setLost(message)
    },
  }
  return { space, newEvent }
}
